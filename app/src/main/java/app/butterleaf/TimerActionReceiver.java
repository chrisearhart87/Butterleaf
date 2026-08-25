package app.butterleaf;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Handles the Stop button on a running-timer notification. */
public class TimerActionReceiver extends BroadcastReceiver {

    public static final String ACTION_STOP = "app.butterleaf.STOP_TIMER";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (intent == null || !ACTION_STOP.equals(intent.getAction())) return;
        TimerNotifications.stopOne(ctx, intent.getStringExtra("id"));
    }
}
