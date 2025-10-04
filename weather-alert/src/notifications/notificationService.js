import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import dayjs from "dayjs";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

/** Ask for permissions on app start */
export async function askNotificationPermission() {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    if (req.status !== "granted") {
      throw new Error("Notification permission not granted");
    }
  }
}

/** Schedule a single notification at a Date */
export async function scheduleWeatherAlert({ when, title, body }) {
  if (!when || dayjs(when).isBefore(dayjs())) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: when.toDate()
  });
}

/**
 * (Optional) Background fetch—re-check forecast periodically.
 * iOS may throttle; Android is more relaxed.
 */
const TASK = "WEATHER_BACKGROUND_CHECK";

export async function registerBackgroundTask(fn) {
  // define the task once
  try {
    TaskManager.defineTask(TASK, async () => {
      try {
        await fn(); // your check+schedule logic
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (e) {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  } catch (_) { /* already defined */ }

  const status = await BackgroundFetch.getStatusAsync();
  if (status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied) {
    return false;
  }

  await BackgroundFetch.registerTaskAsync(TASK, {
    minimumInterval: 15 * 60, // 15 minutes (best effort)
    stopOnTerminate: false,
    startOnBoot: true
  });
  return true;
}
