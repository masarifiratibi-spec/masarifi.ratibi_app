import java.nio.file.Files
import java.nio.file.Path
import java.sql.Connection
import java.sql.DriverManager

// Real file-backed SQLite through JDBC; Android/JNI lifetime still needs device verification.
private class SQLiteErrorException(message: String) : RuntimeException(message)
private class AccessClosedResourceException : RuntimeException()
private class Options(val finalizeUnusedStatementsBeforeClosing: Boolean = true)
private class Binding(path: Path) {
  val connection: Connection = DriverManager.getConnection("jdbc:sqlite:$path")
  fun sqlite3_finalize_all_statement() {}
  fun sqlite3_close(): Int { connection.close(); return 0 }
  fun convertSqlLiteErrorToString() = "fixture close failure"
}
private object NativeDatabaseBinding { const val SQLITE_OK = 0 }
private class NativeDatabase(path: Path) {
  val ref = Binding(path)
  val openOptions = Options()
  var isClosed = false
}
private class Lifecycle {
  val cachedDatabases = mutableListOf<NativeDatabase>()
  @@DRAIN@@
  @@CLOSE@@
  @@FINALIZE@@
  fun destroy() { @@DESTROY@@ }
}
private fun Connection.execute(sql: String) { createStatement().use { it.execute(sql) } }
private fun Connection.count(sql: String): Int = createStatement().use { statement ->
  statement.executeQuery(sql).use { rows -> check(rows.next()); rows.getInt(1) }
}
fun main() {
  Class.forName("org.sqlite.JDBC")
  val directory = Files.createTempDirectory("masarifi-sqlite-lifecycle-")
  val file = directory.resolve("isolated-fixture.db")
  DriverManager.getConnection("jdbc:sqlite:$file").use {
    it.execute("PRAGMA journal_mode=WAL")
    it.execute("CREATE TABLE fixture_drafts (id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
    it.execute("INSERT INTO fixture_drafts VALUES ('retained', 'isolated Arabic draft مسودة')")
  }
  repeat(20) { cycle ->
    val lifecycle = Lifecycle()
    val reader = NativeDatabase(file)
    val writer = NativeDatabase(file)
    lifecycle.cachedDatabases.addAll(listOf(reader, writer))
    writer.ref.connection.execute("BEGIN IMMEDIATE")
    writer.ref.connection.execute("INSERT INTO fixture_drafts VALUES ('uncommitted-$cycle', 'fixture only')")
    lifecycle.destroy(); lifecycle.destroy()
    DriverManager.getConnection("jdbc:sqlite:$file").use {
      it.execute("PRAGMA busy_timeout=100")
      check(it.count("SELECT COUNT(*) FROM fixture_drafts") == 1) { "uncommitted write survived or committed row lost" }
      check(it.count("SELECT COUNT(*) FROM fixture_drafts WHERE id='retained' AND payload='isolated Arabic draft مسودة'") == 1)
      it.execute("BEGIN IMMEDIATE")
      it.execute("ROLLBACK")
    }
    check(reader.isClosed && writer.isClosed)
    check(reader.ref.connection.isClosed && writer.ref.connection.isClosed)
  }
  println("PASS 20 real SQLite teardown cycles: committed draft preserved, uncommitted inserts rolled back, next writer acquired lock")
}
