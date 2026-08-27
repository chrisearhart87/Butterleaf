package app.butterleaf;

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
        Notifs.ensureAlarmChannel(ctx);

        // The service owns the ring and the notification. Starting a foreground
        // service from here is allowed because setAlarmClock puts us on the
        // temporary allowlist for the duration of this broadcast.
        RingService.start(ctx, id, label);

        // Best effort: on most devices this brings the ringing screen straight
        // up. If the OS declines, the full-screen intent on the service's
        // notification is the fallback.
        try {
            Intent ring = new Intent(ctx, AlarmActivity.class);
            ring.setData(Uri.parse("butterleaf://ring/" + id));
            ring.putExtra("id", id);
            ring.putExtra("label", label);
            ring.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
                    | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
            ctx.startActivity(ring);
        } catch (Exception ignored) {
        }
    }
}
