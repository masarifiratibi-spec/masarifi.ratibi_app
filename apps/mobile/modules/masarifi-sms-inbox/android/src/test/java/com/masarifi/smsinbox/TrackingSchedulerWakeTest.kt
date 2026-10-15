package com.masarifi.smsinbox

import android.content.Context
import android.content.ContextWrapper
import android.database.ContentObserver
import android.net.Uri
import android.provider.Telephony
import androidx.work.*
import androidx.work.impl.WorkManagerImpl
import androidx.work.testing.WorkManagerTestInitHelper
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.util.concurrent.atomic.AtomicInteger

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], packageName = "com.masarifi.mobile.dev")
class TrackingSchedulerWakeTest {
  private lateinit var context: Context
  private lateinit var manager: WorkManager
  private val owner = "a".repeat(64)
  private val generation = "11111111-1111-4111-8111-111111111111"

  @Before fun setup() {
    context = object : ContextWrapper(RuntimeEnvironment.getApplication()) {
      override fun getPackageName() = "com.masarifi.mobile.dev"
    }
    WorkManagerTestInitHelper.initializeTestWorkManager(context, Configuration.Builder().build())
    manager = WorkManager.getInstance(context)
    val state = JSONObject().put("owner", owner).put("generation", generation)
      .put("sms", true).put("notification", true)
    context.getSharedPreferences("masarifi_tracking_owner_v2", Context.MODE_PRIVATE)
      .edit().clear().putString("context", state.toString()).commit()
  }

  @Test fun smsRowAndCombinedProviderUpdatesReachTheConfiguredObserver() {
    TrackingScheduler.watchSms(context)
    val watches = manager.getWorkInfosByTag("masarifi-tracking").get()
      .filter { !it.state.isFinished && it.constraints.contentUriTriggers.isNotEmpty() }
    assertEquals(1, watches.size)
    val resolver = context.contentResolver
    val notifications = AtomicInteger()
    val observer = object : ContentObserver(null) {
      override fun onChange(selfChange: Boolean) { notifications.incrementAndGet() }
    }
    for (trigger in watches.single().constraints.contentUriTriggers)
      resolver.registerContentObserver(trigger.uri, trigger.isTriggeredForDescendants, observer)
    try {
      resolver.notifyChange(Uri.parse("content://sms/343"), null)
      assertTrue("A row notification outside /inbox must wake the SMS observer", notifications.get() > 0)
      val before = notifications.get()
      resolver.notifyChange(Telephony.MmsSms.CONTENT_URI, null)
      assertTrue("Combined SMS/MMS notifications must also wake the observer", notifications.get() > before)
    } finally { resolver.unregisterContentObserver(observer) }
  }

  @Test fun configuringDevReplacesAnAlreadyRetainedInboxOnlyWatch() {
    val old = OneTimeWorkRequestBuilder<TrackingWorker>()
      .setConstraints(Constraints.Builder().addContentUriTrigger(Telephony.Sms.Inbox.CONTENT_URI, true).build())
      .addTag("masarifi-tracking").build()
    manager.enqueueUniqueWork("masarifi-tracking-sms", ExistingWorkPolicy.KEEP, old).result.get()
    TrackingScheduler.configure(context)
    val watches = manager.getWorkInfosByTag("masarifi-tracking").get()
      .filter { !it.state.isFinished && it.constraints.contentUriTriggers.isNotEmpty() }
    assertEquals("The old persisted watcher must not survive the native repair", WorkInfo.State.CANCELLED,
      manager.getWorkInfoById(old.id).get()!!.state)
    assertEquals(1, watches.size)
    assertEquals(setOf(Telephony.Sms.CONTENT_URI, Telephony.MmsSms.CONTENT_URI),
      watches.single().constraints.contentUriTriggers.map { it.uri }.toSet())
  }

  @Test fun pendingDevCaptureRetriesPromptlyInsteadOfWaitingForThePeriodicJob() {
    TrackingScheduler.incoming(context)
    val work = manager.getWorkInfosForUniqueWork("masarifi-tracking-incoming").get().single()
    val spec = spec(work)
    assertEquals(BackoffPolicy.LINEAR, spec.backoffPolicy)
    assertEquals(10_000L, spec.backoffDelayDuration)
  }

  @Test fun followUpIsDurablePromptAndCoalescedForTheCurrentOwner() {
    assertTrue(TrackingScheduler.followUp(context, owner, generation))
    assertTrue(TrackingScheduler.followUp(context, owner, generation))
    val work = manager.getWorkInfosForUniqueWork("masarifi-tracking-follow-up").get().single()
    val spec = spec(work)
    assertEquals(3_000L, spec.initialDelay)
    assertEquals(BackoffPolicy.LINEAR, spec.backoffPolicy)
    assertEquals(10_000L, spec.backoffDelayDuration)
    assertEquals(owner, spec.input.getString("ownerDigest"))
    assertEquals(generation, spec.input.getString("generation"))
    TrackingOwner.suspend(context)
    assertEquals(WorkInfo.State.CANCELLED, manager.getWorkInfoById(work.id).get()!!.state)
  }

  @Test fun followUpRejectsStaleOwnerGenerationAndSuspendedIntake() {
    assertFalse(TrackingScheduler.followUp(context, "b".repeat(64), generation))
    assertFalse(TrackingScheduler.followUp(context, owner, "22222222-2222-4222-8222-222222222222"))
    TrackingOwner.suspend(context)
    assertFalse(TrackingScheduler.followUp(context, owner, generation))
    assertTrue(manager.getWorkInfosForUniqueWork("masarifi-tracking-follow-up").get().isEmpty())
  }

  @Test fun ordinaryPackageKeepsItsExistingWatchAndRetryPolicy() {
    val ordinary = object : ContextWrapper(context) {
      override fun getPackageName() = "com.masarifi.mobile"
    }
    assertFalse(TrackingScheduler.followUp(ordinary, owner, generation))
    TrackingScheduler.watchSms(ordinary)
    val work = manager.getWorkInfosForUniqueWork("masarifi-tracking-sms").get().single()
    assertEquals(setOf(Telephony.Sms.Inbox.CONTENT_URI), work.constraints.contentUriTriggers.map { it.uri }.toSet())
    assertEquals(BackoffPolicy.EXPONENTIAL, spec(work).backoffPolicy)
    assertEquals(30_000L, spec(work).backoffDelayDuration)
  }

  private fun spec(work: WorkInfo): androidx.work.impl.model.WorkSpec {
    // Reflect across Room's implementation-only dependency; inspect the persisted WorkSpec.
    val database = WorkManagerImpl::class.java.getMethod("getWorkDatabase").invoke(manager)
    val dao = database.javaClass.getMethod("workSpecDao").invoke(database)
    return dao.javaClass.getMethod("getWorkSpec", String::class.java).invoke(dao, work.id.toString()) as androidx.work.impl.model.WorkSpec
  }
}
