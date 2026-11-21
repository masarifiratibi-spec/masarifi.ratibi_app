package com.masarifi.smsinbox

import android.content.Context
import androidx.work.Configuration
import androidx.work.testing.WorkManagerTestInitHelper
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/** November 4: changing capture owner must not erase another owner's retained work. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class TrackingOwnerPartitionTest {
  private lateinit var context: Context
  private val retainedOwner = "b".repeat(64)
  private val currentOwner = "a".repeat(64)
  private val generation = "11111111-1111-4111-8111-111111111111"
  private fun prefs(name: String) = context.getSharedPreferences(name, Context.MODE_PRIVATE)

  @Before fun setup() {
    context = RuntimeEnvironment.getApplication()
    WorkManagerTestInitHelper.initializeTestWorkManager(context, Configuration.Builder().build())
  }

  @Test fun staleLegacyConfigurationCannotEraseAnotherOwnersRetainedQueue() {
    val retainedContext = JSONObject().put("owner", retainedOwner).put("generation", generation)
      .put("sms", true).put("notification", true).toString()
    prefs("masarifi_tracking_owner_v2").edit().putString("context", retainedContext).commit()
    val queue = prefs("masarifi_notification_queue_v2_" + retainedOwner)
    queue.edit().putString("ciphertext", "public synthetic opaque ciphertext").commit()
    try {
      TrackingOwner.configure(context, currentOwner, generation, false, false, emptyList(), emptyList(), null)
    } catch (expected: IllegalStateException) {
      assertEquals("tracking_owner_transition_required", expected.message)
    }
    assertEquals("public synthetic opaque ciphertext", queue.getString("ciphertext", null))
    assertEquals(retainedContext, prefs("masarifi_tracking_owner_v2").getString("context", null))
  }
}
