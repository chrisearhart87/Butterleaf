package app.butterleaf;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;

public class Notifs {

    /** Retired. The channel owned the sound, so Android hushed it on shade open. */
    private static final String CHANNEL_ALARM_OLD = "butterleaf_bake_timers";
    public static final String CHANNEL_ALARM_V2 = "butterleaf_alarm_v2";
    public static final String CHANNEL_RUNNING = "butterleaf_running_timers";
    public static final long[] PATTERN = {0, 600, 400, 600, 400, 900};

    /**
     * The alarm channel is deliberately SILENT. The ringing is played by
     * RingService instead, so the only things that stop it are Stop and Snooze —
     * not merely pulling down the shade, which is what silences a channel sound.
     */
    public static void ensureAlarmChannel(Context ctx) {
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        try {
            if (nm.getNotificationChannel(CHANNEL_ALARM_OLD) != null) {
                nm.deleteNotificationChannel(CHANNEL_ALARM_OLD);
            }
        } catch (Exception ignored) {
        }
        if (nm.getNotificationChannel(CHANNEL_ALARM_V2) != null) return;

        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ALARM_V2,
                ctx.getString(R.string.alarm_channel_name),
                NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription(ctx.getString(R.string.alarm_channel_desc));
        ch.enableVibration(false);
        ch.setSound(null, null);
        ch.setBypassDnd(true);
        ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    /** Kept for older call sites. */
    public static void ensureChannel(Context ctx) {
        ensureAlarmChannel(ctx);
    }

    /** Silent channel for the live countdowns sitting in the shade. */
    public static void ensureRunningChannel(Context ctx) {
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_RUNNING) != null) return;

        NotificationChannel ch = new NotificationChannel(
                CHANNEL_RUNNING,
                ctx.getString(R.string.running_channel_name),
                NotificationManager.IMPORTANCE_LOW);
        ch.setDescription(ctx.getString(R.string.running_channel_desc));
        ch.enableVibration(false);
        ch.setSound(null, null);
        ch.setShowBadge(false);
        ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    public static void vibrate(Context ctx, int ms) {
        try {
            Vibrator v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= 26) {
                v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                v.vibrate(ms);
            }
        } catch (Exception ignored) {
        }
    }
}
