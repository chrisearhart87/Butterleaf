package app.butterleaf;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class AlarmActivity extends Activity {

    private static final long AUTO_STOP_MS = 5 * 60 * 1000L;

    private MediaPlayer player;
    private Vibrator vibrator;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String timerId = "timer";
    private String label = "Bake timer";
    private long startedAt;
    private TextView elapsedView;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            long s = (System.currentTimeMillis() - startedAt) / 1000L;
            if (elapsedView != null) {
                elapsedView.setText(String.format(java.util.Locale.US,
                        "ringing for %d:%02d", s / 60, s % 60));
            }
            if (s * 1000L > AUTO_STOP_MS) {
                stopEverything();
                finish();
                return;
            }
            handler.postDelayed(this, 1000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Intent i = getIntent();
        if (i != null) {
            if (i.getStringExtra("id") != null) timerId = i.getStringExtra("id");
            if (i.getStringExtra("label") != null) label = i.getStringExtra("label");
            if (i.getBooleanExtra("dismiss", false)) {
                clearNotification();
                finish();
                return;
            }
        }

        showOverLockscreen();
        clearNotification();
        setContentView(buildUi());
        startRinging();
        startedAt = System.currentTimeMillis();
        handler.post(tick);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && intent.getBooleanExtra("dismiss", false)) {
            stopEverything();
            finish();
        }
    }

    private void showOverLockscreen() {
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    private View buildUi() {
        int ink = Color.parseColor("#121110");
        int paper = Color.parseColor("#F5F1EB");
        int raspberry = Color.parseColor("#E8446E");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(ink);
        int pad = dp(28);
        root.setPadding(pad, pad, pad, pad);

        TextView kicker = new TextView(this);
        kicker.setText("BUTTERLEAF");
        kicker.setTextColor(Color.parseColor("#8A8178"));
        kicker.setTextSize(12);
        kicker.setLetterSpacing(0.28f);
        kicker.setGravity(Gravity.CENTER);
        root.addView(kicker);

        TextView title = new TextView(this);
        title.setText(label);
        title.setTextColor(paper);
        title.setTextSize(38);
        title.setTypeface(Typeface.create(Typeface.SERIF, Typeface.NORMAL));
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(18), 0, dp(6));
        root.addView(title);

        TextView sub = new TextView(this);
        sub.setText("Time's up.");
        sub.setTextColor(raspberry);
        sub.setTextSize(17);
        sub.setGravity(Gravity.CENTER);
        root.addView(sub);

        elapsedView = new TextView(this);
        elapsedView.setText("ringing for 0:00");
        elapsedView.setTextColor(Color.parseColor("#6F6862"));
        elapsedView.setTextSize(13);
        elapsedView.setGravity(Gravity.CENTER);
        elapsedView.setPadding(0, dp(10), 0, dp(38));
        root.addView(elapsedView);

        Button stop = filledButton("STOP", raspberry, Color.WHITE);
        stop.setOnClickListener(v -> {
            stopEverything();
            finish();
        });
        root.addView(stop);

        Button snooze = outlineButton("SNOOZE 5 MIN", paper);
        snooze.setOnClickListener(v -> {
            stopEverything();
            AlarmScheduler.schedule(this, timerId + "_snooze",
                    System.currentTimeMillis() + 5 * 60 * 1000L, label + " (snoozed)");
            finish();
        });
        root.addView(snooze);

        return root;
    }

    private Button filledButton(String text, int bg, int fg) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextColor(fg);
        b.setTextSize(15);
        b.setLetterSpacing(0.14f);
        b.setAllCaps(false);
        GradientDrawable d = new GradientDrawable();
        d.setColor(bg);
        d.setCornerRadius(dp(999));
        b.setBackground(d);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(58));
        lp.bottomMargin = dp(12);
        b.setLayoutParams(lp);
        return b;
    }

    private Button outlineButton(String text, int fg) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextColor(fg);
        b.setTextSize(14);
        b.setLetterSpacing(0.14f);
        b.setAllCaps(false);
        GradientDrawable d = new GradientDrawable();
        d.setColor(Color.TRANSPARENT);
        d.setStroke(dp(1), Color.parseColor("#3A3532"));
        d.setCornerRadius(dp(999));
        b.setBackground(d);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(54));
        b.setLayoutParams(lp);
        return b;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private void startRinging() {
        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            if (uri != null) {
                player = new MediaPlayer();
                player.setDataSource(this, uri);
                player.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
                player.setLooping(true);
                player.prepare();
                player.start();
            }
        } catch (Exception ignored) {
        }

        try {
            vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= 26) {
                    vibrator.vibrate(VibrationEffect.createWaveform(Notifs.PATTERN, 1));
                } else {
                    vibrator.vibrate(Notifs.PATTERN, 1);
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void stopEverything() {
        handler.removeCallbacks(tick);
        try {
            if (player != null) {
                player.stop();
                player.release();
                player = null;
            }
        } catch (Exception ignored) {
        }
        try {
            if (vibrator != null) vibrator.cancel();
        } catch (Exception ignored) {
        }
        clearNotification();
    }

    private void clearNotification() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(timerId.hashCode());
    }

    @Override
    protected void onDestroy() {
        stopEverything();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        stopEverything();
        super.onBackPressed();
    }
}
