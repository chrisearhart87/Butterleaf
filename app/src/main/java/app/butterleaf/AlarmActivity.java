package app.butterleaf;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.lang.ref.WeakReference;

/**
 * The full-screen "time's up" screen.
 *
 * It no longer owns the sound. RingService does. This screen is only a set of
 * buttons — closing it, backgrounding it, or swiping it away leaves the alarm
 * ringing, exactly like a phone's own alarm clock. Only Stop or Snooze end it.
 */
public class AlarmActivity extends Activity {

    private static WeakReference<AlarmActivity> LIVE;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private String timerId = "timer";
    private String label = "Bake timer";
    private TextView elapsedView;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (!RingService.isRinging()) {
                finish();
                return;
            }
            long s = Math.max(0, (System.currentTimeMillis() - RingService.ringingSince()) / 1000L);
            if (elapsedView != null) {
                elapsedView.setText(String.format(java.util.Locale.US,
                        "ringing for %d:%02d", s / 60, s % 60));
            }
            handler.postDelayed(this, 1000);
        }
    };

    /** Called by RingService once the alarm has actually been stopped. */
    public static void dismissIfShowing(Context ctx) {
        try {
            final AlarmActivity a = LIVE == null ? null : LIVE.get();
            if (a == null || a.isFinishing()) return;
            a.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    a.finish();
                }
            });
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LIVE = new WeakReference<>(this);

        readIntent(getIntent());

        showOverLockscreen();
        setContentView(buildUi());
        handler.post(tick);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        readIntent(intent);
        setContentView(buildUi());
        handler.removeCallbacks(tick);
        handler.post(tick);
    }

    private void readIntent(Intent i) {
        if (i == null) return;
        if (i.getStringExtra("id") != null) timerId = i.getStringExtra("id");
        if (i.getStringExtra("label") != null) label = i.getStringExtra("label");
        // A stale launcher entry pointing at an alarm nobody is ringing anymore.
        if (!RingService.isRinging()) finish();
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
            RingService.stop(this, timerId);
            finish();
        });
        root.addView(stop);

        int mine = RingService.snoozeMinutes(this);
        Button snooze = outlineButton("SNOOZE " + mine + " MIN", paper);
        snooze.setOnClickListener(v -> {
            RingService.snooze(this, timerId, mine);
            finish();
        });
        root.addView(snooze);

        // Sometimes five minutes is not the five minutes you wanted.
        TextView pickHint = new TextView(this);
        pickHint.setText("OR SNOOZE FOR");
        pickHint.setTextColor(Color.parseColor("#6F6862"));
        pickHint.setTextSize(11);
        pickHint.setLetterSpacing(0.2f);
        pickHint.setGravity(Gravity.CENTER);
        pickHint.setPadding(0, dp(22), 0, dp(10));
        root.addView(pickHint);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);
        int[] choices = {1, 2, 5, 10, 20};
        for (int m : choices) {
            final int mm = m;
            Button chip = chipButton(m + "m", paper);
            chip.setOnClickListener(v -> {
                RingService.snooze(this, timerId, mm);
                finish();
            });
            row.addView(chip);
        }
        root.addView(row);

        TextView hint = new TextView(this);
        hint.setText("Keeps ringing until you stop it.");
        hint.setTextColor(Color.parseColor("#57514C"));
        hint.setTextSize(12);
        hint.setGravity(Gravity.CENTER);
        hint.setPadding(0, dp(18), 0, 0);
        root.addView(hint);

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

    private Button chipButton(String text, int fg) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextColor(fg);
        b.setTextSize(13);
        b.setAllCaps(false);
        b.setPadding(0, 0, 0, 0);
        b.setMinWidth(0);
        b.setMinimumWidth(0);
        GradientDrawable d = new GradientDrawable();
        d.setColor(Color.parseColor("#1D1A18"));
        d.setStroke(dp(1), Color.parseColor("#332F2C"));
        d.setCornerRadius(dp(999));
        b.setBackground(d);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(58), dp(44));
        lp.setMarginEnd(dp(8));
        b.setLayoutParams(lp);
        return b;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(tick);
        if (LIVE != null && LIVE.get() == this) LIVE = null;
        // Deliberately does NOT silence anything.
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        // Leave it ringing — the notification is still there with Stop on it.
        super.onBackPressed();
    }
}
