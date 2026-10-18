// Native calls are the boundary; the lifecycle methods below come from SQLiteModule.kt.
private class SQLiteErrorException(message: String) : RuntimeException(message)
private class AccessClosedResourceException : RuntimeException()
private class Options(val finalizeUnusedStatementsBeforeClosing: Boolean = true)
private class Binding(val closeError: Boolean) {
  var attempts = 0
  var finalized = false
  fun sqlite3_finalize_all_statement() { finalized = true }
  fun sqlite3_close(): Int { attempts++; return if (closeError) 5 else 0 }
  fun convertSqlLiteErrorToString() = "fixture close failure"
}
private object NativeDatabaseBinding { const val SQLITE_OK = 0 }
private class NativeDatabase(fails: Boolean = false) {
  val ref = Binding(fails)
  val openOptions = Options()
  var isClosed = false
}
private class Lifecycle {
  val cachedDatabases = mutableListOf<NativeDatabase>()
  @@DRAIN@@
  @@CLOSE@@
  @@FINALIZE@@
  fun drain() = removeAllCachedDatabases()
  fun destroy() { @@DESTROY@@ }
}

fun main() {
  val failures = mutableListOf<String>()
  fun scenario(name: String, run: () -> Unit) {
    try { run(); println("PASS $name") }
    catch (failure: Throwable) { failures.add(name); println("FAIL $name: ${failure.message}") }
  }
  scenario("drain preserves every connection and empties the cache once") {
    val lifecycle = Lifecycle()
    val first = NativeDatabase(); val second = NativeDatabase()
    lifecycle.cachedDatabases.addAll(listOf(first, second))
    check(lifecycle.drain() == listOf(first, second)) { "drained connections were lost" }
    check(lifecycle.cachedDatabases.isEmpty())
    check(lifecycle.drain().isEmpty())
  }
  scenario("teardown finalizes and closes all cached connections once") {
    val lifecycle = Lifecycle()
    val connections = List(3) { NativeDatabase() }
    lifecycle.cachedDatabases.addAll(connections)
    lifecycle.destroy(); lifecycle.destroy()
    check(connections.all { it.isClosed && it.ref.finalized && it.ref.attempts == 1 })
  }
  scenario("one failed close does not strand later connections") {
    val lifecycle = Lifecycle()
    val broken = NativeDatabase(fails = true); val healthy = NativeDatabase()
    lifecycle.cachedDatabases.addAll(listOf(broken, healthy))
    lifecycle.destroy()
    check(broken.ref.attempts == 1 && !broken.isClosed)
    check(healthy.isClosed && healthy.ref.attempts == 1) { "later close was skipped" }
  }
  scenario("empty teardown is harmless") { Lifecycle().destroy() }
  check(failures.isEmpty()) { "${failures.size} lifecycle regressions" }
}
