package app.butterleaf;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Owns the ringing.
 *
 * The sound used to live on the AlarmActivity and on the notification channel,
 * which meant Android politely hushed it the moment you pulled down the shade,
 * and the activity restarted it when you came back. Now nothing but an explicit
 * Stop or Snooze silences it: the ring belongs to a foreground service that
 * outlives both the shade and the activity.
 */
public class RingService extends Service {

    public static final String ACTION_START = "app.butterleaf.RING_START";
    public static final String ACTION_STOP = "app.butterleaf.RING_STOP";
    public static final String ACTION_STOP_ALL = "app.butterleaf.RING_STOP_ALL";
    public static final String ACTION_SNOOZE = "app.butterleaf.RING_SNOOZE";

    private static final int FG_ID = 0xB17E;
    /** Nobody wants a timer howling all night if the phone is left behind. */
    private static final long GIVE_UP_MS = 15 * 60 * 1000L;
    private static final String PREFS = "butterleaf_alarms";
    private static final String KEY_SNOOZE = "snoozeMin";
    private static final int DEFAULT_SNOOZE_MIN = 5;

    /** Every alarm currently ringing, oldest first. */
    private static final LinkedHashMap<String, String> RINGING = new LinkedHashMap<>();
    private static volatile long RING_SINCE = 0L;

    public static long ringingSince() {
        return RING_SINCE == 0 ? System.currentTimeMillis() : RING_SINCE;
    }

    private MediaPlayer player;
    private Vibrator vibrator;
    private PowerManager.WakeLock wake;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<String, Runnable> giveUps = new LinkedHashMap<>();

    // ------------------------------------------------------------ public API

    public static void start(Context ctx, String id, String label) {
        // Registered here rather than in onStartCommand so isRinging() is true
        // the instant the alarm fires, before the service has been handed the
        // intent — the UI asks about it that quickly.
        synchronized (RINGING) {
            if (RINGING.isEmpty()) RING_SINCE = System.currentTimeMillis();
            RINGING.put(id, (label == null || label.trim().isEmpty()) ? "Bake timer" : label);
        }
        Intent i = new Intent(ctx, RingService.class)
                .setAction(ACTION_START)
                .putExtra("id", id)
                .putExtra("label", label);
        launch(ctx, i);
    }

    public static void stop(Context ctx, String id) {
        if (!isRinging()) return; // nothing to hush — don't spin up a service
        launch(ctx, new Intent(ctx, RingService.class).setAction(ACTION_STOP).putExtra("id", id));
    }

    /** Snooze for the user's chosen default. */
    public static void snooze(Context ctx, String id) {
        snooze(ctx, id, 0);
    }

    /** Snooze for a specific number of minutes; 0 means "use the default". */
    public static void snooze(Context ctx, String id, int minutes) {
        if (!isRinging()) return;
        launch(ctx, new Intent(ctx, RingService.class)
                .setAction(ACTION_SNOOZE)
                .putExtra("id", id)
                .putExtra("mins", minutes));
    }

    /** How long Snooze waits, in minutes. Kept in prefs so the service, the
     *  notification and the alarm screen all agree without asking the WebView. */
    public static int snoozeMinutes(Context ctx) {
        try {
            int m = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .getInt(KEY_SNOOZE, DEFAULT_SNOOZE_MIN);
            return m < 1 ? DEFAULT_SNOOZE_MIN : Math.min(m, 120);
        } catch (Exception e) {
            return DEFAULT_SNOOZE_MIN;
        }
    }

    public static void setSnoozeMinutes(Context ctx, int minutes) {
        try {
            if (minutes < 1) minutes = DEFAULT_SNOOZE_MIN;
            if (minutes > 120) minutes = 120;
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putInt(KEY_SNOOZE, minutes).apply();
        } catch (Exception ignored) {
        }
    }

    public static void stopAll(Context ctx) {
        if (!isRinging()) return;
        launch(ctx, new Intent(ctx, RingService.class).setAction(ACTION_STOP_ALL));
    }

    /** Label of the alarm that should be on screen, or null if nothing is ringing. */
    public static String currentLabel() {
        synchronized (RINGING) {
            String last = null;
            for (String v : RINGING.values()) last = v;
            return last;
        }
    }

    public static String currentId() {
        synchronized (RINGING) {
            String last = null;
            for (String k : RINGING.keySet()) last = k;
            return last;
        }
    }

    public static boolean isRinging() {
        synchronized (RINGING) {
            return !RINGING.isEmpty();
        }
    }

    private static void launch(Context ctx, Intent i) {
        try {
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i);
            else ctx.startService(i);
        } catch (Exception ignored) {
        }
    }

    // ------------------------------------------------------------- lifecycle

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        String id = intent == null ? null : intent.getStringExtra("id");
        String label = intent == null ? null : intent.getStringExtra("label");
        if (label == null || label.trim().isEmpty()) label = "Bake timer";
        // The in-app bar and the sheet address "whatever is ringing" with an
        // empty id. Treat that the same as no id at all, or Stop and Snooze
        // quietly act on a timer that does not exist.
        if (id != null && id.trim().isEmpty()) id = null;

        if (ACTION_START.equals(action) && id != null) {
            synchronized (RINGING) {
                if (RINGING.isEmpty()) RING_SINCE = System.currentTimeMillis();
                RINGING.put(id, label);
            }
        }

        // Android gives us a few seconds from startForegroundService() to call
        // startForeground() or it kills the process. Do it first, always, on
        // every path — including the stop paths, which then immediately undo it.
        Notification n = buildNotification();
        try {
            startForeground(FG_ID, n);
        } catch (Throwable t) {
            // Some OEMs refuse a foreground start from the background. Post the
            // notification anyway so Stop is still one tap away, and ring on.
            try {
                NotificationManager nm = getSystemService(NotificationManager.class);
                if (nm != null) nm.notify(FG_ID, n);
            } catch (Exception ignored) {
            }
        }

        if (ACTION_STOP.equals(action)) {
            if (id == null) id = currentId();
            release(id, true);
            return START_NOT_STICKY;
        }
        if (ACTION_STOP_ALL.equals(action)) {
            releaseAll();
            return START_NOT_STICKY;
        }
        if (ACTION_SNOOZE.equals(action)) {
            if (id == null) id = currentId();
            String snoozeLabel;
            synchronized (RINGING) {
                snoozeLabel = RINGING.get(id);
            }
            if (snoozeLabel == null) snoozeLabel = label;
            int mins = intent == null ? 0 : intent.getIntExtra("mins", 0);
            if (mins < 1) mins = snoozeMinutes(this);
            // Hush first — release() clears the stored alarm — then re-arm it,
            // keeping the same id so the timer in the app stays the same timer.
            release(id, false);
            if (id != null && !id.trim().isEmpty()) {
                AlarmScheduler.schedule(this, id,
                        System.currentTimeMillis() + mins * 60000L, snoozeLabel);
            }
            return START_NOT_STICKY;
        }

        if (id != null) armGiveUp(id);
        startRinging();
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        silence();
        releaseWake();
        synchronized (RINGING) {
            RINGING.clear();
        }
        RING_SINCE = 0L;
        super.onDestroy();
    }

    // ---------------------------------------------------------------- ringing

    private void armGiveUp(final String id) {
        Runnable prev = giveUps.remove(id);
        if (prev != null) handler.removeCallbacks(prev);
        Runnable r = new Runnable() {
            @Override
            public void run() {
                release(id, true);
            }
        };
        giveUps.put(id, r);
        handler.postDelayed(r, GIVE_UP_MS);
    }

    private void startRinging() {
        keepAwake();
        if (player != null) return; // already going — a second timer joins the same ring

        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            if (uri != null) {
                MediaPlayer mp = new MediaPlayer();
                mp.setDataSource(this, uri);
                mp.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
                mp.setLooping(true);
                mp.prepare();
                mp.start();
                player = mp;
            }
        } catch (Exception ignored) {
            player = null;
        }

        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= 26) {
                    vibrator.vibrate(VibrationEffect.createWaveform(Notifs.PATTERN, 1),
                            new AudioAttributes.Builder()
                                    .setUsage(AudioAttributes.USAGE_ALARM)
                                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                    .build());
                } else {
                    vibrator.vibrate(Notifs.PATTERN, 1);
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void silence() {
        try {
            if (player != null) {
                player.stop();
                player.release();
            }
        } catch (Exception ignored) {
        }
        player = null;
        try {
            if (vibrator != null) vibrator.cancel();
        } catch (Exception ignored) {
        }
        vibrator = null;
    }

    /**
     * Stop one alarm. If others are still due, keep ringing for them.
     * {@code finished} tells the web layer the timer is done with — false when
     * we are only snoozing and the timer is about to come back.
     */
    private void release(String id, boolean finished) {
        if (id != null) {
            Runnable r = giveUps.remove(id);
            if (r != null) handler.removeCallbacks(r);
            synchronized (RINGING) {
                RINGING.remove(id);
            }
            TimerNotifications.clearOne(this, id);
            AlarmScheduler.forget(this, id);
            if (finished) noteStopped(id);
        }
        if (isRinging()) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                try {
                    nm.notify(FG_ID, buildNotification());
                } catch (Exception ignored) {
                }
            }
            return;
        }
        finishUp();
    }

    private void releaseAll() {
        ArrayList<String> ids;
        synchronized (RINGING) {
            ids = new ArrayList<>(RINGING.keySet());
        }
        for (String id : ids) {
            Runnable r = giveUps.remove(id);
            if (r != null) handler.removeCallbacks(r);
            TimerNotifications.clearOne(this, id);
            AlarmScheduler.forget(this, id);
            noteStopped(id);
        }
        synchronized (RINGING) {
            RINGING.clear();
        }
        finishUp();
    }

    private void finishUp() {
        silence();
        releaseWake();
        AlarmActivity.dismissIfShowing(this);
        try {
            if (Build.VERSION.SDK_INT >= 24) stopForeground(Service.STOP_FOREGROUND_REMOVE);
            else stopForeground(true);
        } catch (Exception ignored) {
        }
        try {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.cancel(FG_ID);
        } catch (Exception ignored) {
        }
        stopSelf();
    }

    /** Let the web layer clear the timer next time it looks. */
    private void noteStopped(String id) {
        try {
            TimerNotifications.markCancelled(this, id);
        } catch (Exception ignored) {
        }
    }

    private void keepAwake() {
        try {
            if (wake != null && wake.isHeld()) return;
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm == null) return;
            wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "butterleaf:ring");
            wake.setReferenceCounted(false);
            wake.acquire(GIVE_UP_MS + 60_000L);
        } catch (Exception ignored) {
        }
    }

    private void releaseWake() {
        try {
            if (wake != null && wake.isHeld()) wake.release();
        } catch (Exception ignored) {
        }
        wake = null;
    }

    // ----------------------------------------------------------- notification

    private Notification buildNotification() {
        Notifs.ensureAlarmChannel(this);

        String id = currentId();
        String label = currentLabel();
        if (label == null) label = "Bake timer";
        if (id == null) id = "timer";

        int count;
        synchronized (RINGING) {
            count = RINGING.size();
        }

        Intent open = new Intent(this, AlarmActivity.class)
                .setData(Uri.parse("butterleaf://ring/" + id))
                .putExtra("id", id)
                .putExtra("label", label)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
        PendingIntent openPi = PendingIntent.getActivity(this, ("o" + id).hashCode(), open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        int mins = snoozeMinutes(this);
        PendingIntent stopPi = servicePi(ACTION_STOP, id, "s", 0);
        PendingIntent snoozePi = servicePi(ACTION_SNOOZE, id, "z", mins);

        String text = count > 1
                ? "Time's up — and " + (count - 1) + " more timer" + (count > 2 ? "s" : "") + " finished."
                : "Time's up — your bake is ready to check.";

        Notification.Builder b = new Notification.Builder(this, Notifs.CHANNEL_ALARM_V2)
                .setSmallIcon(R.drawable.ic_timer)
                .setContentTitle(label)
                .setContentText(text)
                .setCategory(Notification.CATEGORY_ALARM)
                .setOngoing(true)
                .setAutoCancel(false)
                .setOnlyAlertOnce(true)
                .setContentIntent(openPi)
                .setFullScreenIntent(openPi, true)
                .addAction(new Notification.Action.Builder(
                        android.graphics.drawable.Icon.createWithResource(this, R.drawable.ic_timer),
                        "Stop", stopPi).build())
                .addAction(new Notification.Action.Builder(
                        android.graphics.drawable.Icon.createWithResource(this, R.drawable.ic_timer),
                        "Snooze " + mins + " min", snoozePi).build());
        if (Build.VERSION.SDK_INT >= 31) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        return b.build();
    }

    private PendingIntent servicePi(String action, String id, String tag, int mins) {
        Intent i = new Intent(this, RingService.class)
                .setAction(action)
                .setData(Uri.parse("butterleaf://" + tag + "/" + id + "/" + mins))
                .putExtra("id", id)
                .putExtra("mins", mins);
        if (Build.VERSION.SDK_INT >= 26) {
            return PendingIntent.getForegroundService(this, (tag + id + mins).hashCode(), i,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        }
        return PendingIntent.getService(this, (tag + id + mins).hashCode(), i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
