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

    public static final String CHANNEL_ALARM = "butterleaf_bake_timers";
    public static final long[] PATTERN = {0, 600, 400, 600, 400, 900};

    public static void ensureChannel(Context ctx) {
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ALARM) != null) return;

        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ALARM,
                ctx.getString(R.string.alarm_channel_name),
                NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription(ctx.getString(R.string.alarm_channel_desc));
        ch.enableVibration(true);
        ch.setVibrationPattern(PATTERN);
        ch.setBypassDnd(true);
        ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

        Uri alarm = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarm == null) alarm = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        ch.setSound(alarm, attrs);
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
