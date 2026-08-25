package app.butterleaf;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

public class AlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String id = intent.getStringExtra("id");
        String label = intent.getStringExtra("label");
        if (id == null) id = "timer";
        if (label == null || label.trim().isEmpty()) label = "Bake timer";

        AlarmScheduler.forget(ctx, id);
        TimerNotifications.clearOne(ctx, id);
        Notifs.ensureChannel(ctx);

        Intent ring = new Intent(ctx, AlarmActivity.class);
        ring.setData(Uri.parse("butterleaf://ring/" + id));
        ring.putExtra("id", id);
        ring.putExtra("label", label);
        ring.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);

        PendingIntent full = PendingIntent.getActivity(ctx, id.hashCode(), ring,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent dismiss = new Intent(ctx, AlarmActivity.class);
        dismiss.setData(Uri.parse("butterleaf://dismiss/" + id));
        dismiss.putExtra("id", id);
        dismiss.putExtra("dismiss", true);
        dismiss.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent dismissPi = PendingIntent.getActivity(ctx, ("d" + id).hashCode(), dismiss,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification n = new Notification.Builder(ctx, Notifs.CHANNEL_ALARM)
                .setSmallIcon(R.drawable.ic_timer)
                .setContentTitle(label)
                .setContentText("Time's up — your bake is ready to check.")
                .setCategory(Notification.CATEGORY_ALARM)
                .setPriority(Notification.PRIORITY_MAX)
                .setAutoCancel(true)
                .setOngoing(true)
                .setVibrate(Notifs.PATTERN)
                .setContentIntent(full)
                .setFullScreenIntent(full, true)
                .addAction(new Notification.Action.Builder(
                        Icon(ctx), "Stop", dismissPi).build())
                .build();

        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(id.hashCode(), n);

        // Best effort: on many devices this brings the ringing screen straight up.
        try {
            ctx.startActivity(ring);
        } catch (Exception ignored) {
        }
    }

    private static android.graphics.drawable.Icon Icon(Context ctx) {
        return android.graphics.drawable.Icon.createWithResource(ctx, R.drawable.ic_timer);
    }
}
