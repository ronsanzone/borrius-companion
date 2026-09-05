package dev.borrius.courier;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.widget.*;
import androidx.documentfile.provider.DocumentFile;
import java.util.*;

public final class MainActivity extends Activity {
  private TextView status, details;
  private EditText origin, code;
  private final Handler handler = new Handler();
  private final Runnable refresh =
      new Runnable() {
        public void run() {
          refreshStatus();
          handler.postDelayed(this, 1500);
        }
      };

  private int dp(int v) {
    return (int) (v * getResources().getDisplayMetrics().density);
  }

  private TextView text(String value, int size, int color) {
    TextView t = new TextView(this);
    t.setText(value);
    t.setTextSize(size);
    t.setTextColor(color);
    t.setPadding(0, dp(7), 0, dp(7));
    return t;
  }

  private Button button(String title, View.OnClickListener onClick) {
    Button b = new Button(this);
    b.setText(title);
    b.setAllCaps(false);
    b.setTextSize(17);
    b.setOnClickListener(onClick);
    return b;
  }

  @Override
  public void onCreate(Bundle b) {
    super.onCreate(b);
    ScrollView sc = new ScrollView(this);
    sc.setFillViewport(true);
    sc.setBackgroundColor(Color.rgb(17, 27, 37));
    LinearLayout col = new LinearLayout(this);
    col.setOrientation(LinearLayout.VERTICAL);
    col.setPadding(dp(24), dp(32), dp(24), dp(30));
    sc.addView(col);
    setContentView(sc);
    col.addView(text("BORRIUS / SAVE COURIER", 12, 0xff6de3b2));
    col.addView(text("Play. Save. Stay in sync.", 27, Color.WHITE));
    col.addView(
        text("Read-only snapshots from your Retroid to your private companion.", 16, 0xffb8c7d5));
    status = text("", 18, 0xff6de3b2);
    col.addView(status);
    details = text("", 13, 0xffb8c7d5);
    col.addView(details);
    col.addView(
        button(
            "Sync now",
            v -> {
              Courier.now(this);
              refreshStatus();
            }));
    col.addView(
        button(
            "Choose save folder",
            v -> {
              Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
              i.addFlags(
                  Intent.FLAG_GRANT_READ_URI_PERMISSION
                      | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                      | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
              startActivityForResult(i, 10);
            }));
    col.addView(text("Connect your dashboard", 20, Color.WHITE));
    origin = new EditText(this);
    origin.setTextColor(Color.WHITE);
    origin.setHintTextColor(0xff94a6b8);
    origin.setSingleLine(true);
    origin.setInputType(
        android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
    origin.setHint("https://upload.your-domain.com");
    origin.setText(Courier.prefs(this).getString("origin", "https://borrius-sync.ronsanzone.dev"));
    col.addView(origin);
    code = new EditText(this);
    code.setTextColor(Color.WHITE);
    code.setHintTextColor(0xff94a6b8);
    code.setSingleLine(true);
    code.setInputType(
        android.text.InputType.TYPE_CLASS_TEXT
            | android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
            | android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
    code.setHint("One-time pairing code");
    col.addView(code);
    col.addView(
        button(
            "Pair device",
            v -> {
              String u = origin.getText().toString(), p = code.getText().toString();
              try {
                SaveRules.origin(u);
                if (p.trim().isEmpty())
                  throw new IllegalArgumentException("Enter the pairing code from your dashboard.");
              } catch (Exception e) {
                toast(e.getMessage());
                return;
              }
              v.setEnabled(false);
              new Thread(
                      () -> {
                        String error = null;
                        try {
                          Courier.pair(this, u, p);
                        } catch (Courier.AuthError e) {
                          error = "Pairing code rejected or expired. Create a new code.";
                        } catch (Exception e) {
                          error =
                              e instanceof java.io.IOException
                                  ? e.getMessage()
                                  : "Pairing failed. Check the upload URL and code.";
                        }
                        String finalError = error;
                        runOnUiThread(
                            () -> {
                              v.setEnabled(true);
                              if (finalError != null) toast(finalError);
                              else code.setText("");
                              refreshStatus();
                            });
                      })
                  .start();
            }));
    col.addView(
        text(
            "Quiet sync checks about every 15 minutes on unmetered Wi-Fi. Android may delay it to"
                + " save battery. Sync now also requires Wi-Fi.",
            14,
            0xffb8c7d5));
    col.addView(
        text(
            "Use Unbound’s in-game Save menu. Save states are separate. This app never changes your"
                + " saves or emulator settings. Manage or revoke this device on your dashboard.",
            14,
            0xffb8c7d5));
    if (!Courier.prefs(this).getString("token", "").isEmpty()) Courier.schedule(this);
  }

  void toast(String s) {
    new AlertDialog.Builder(this).setMessage(s).setPositiveButton("OK", null).show();
  }

  void refreshStatus() {
    android.content.SharedPreferences p = Courier.prefs(this);
    status.setText(p.getString("status", "Ready to connect"));
    details.setText(
        "Save: "
            + p.getString("saveName", "not selected")
            + "\nQueued: "
            + Courier.pending(this).length
            + "  •  Receipt: "
            + p.getString("receiptStatus", "none")
            + "\nLast synced capture: "
            + p.getString("lastUploaded", "not yet"));
  }

  @Override
  protected void onResume() {
    super.onResume();
    handler.post(refresh);
  }

  @Override
  protected void onPause() {
    super.onPause();
    handler.removeCallbacks(refresh);
  }

  @Override
  protected void onActivityResult(int request, int result, Intent data) {
    super.onActivityResult(request, result, data);
    if (request == 10 && result == RESULT_OK && data != null && data.getData() != null) {
      Uri uri = data.getData();
      try {
        getContentResolver()
            .takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Courier.prefs(this).edit().putString("tree", uri.toString()).commit();
        pick(DocumentFile.fromTreeUri(this, uri));
      } catch (Exception e) {
        toast("Could not keep read access. Please choose the RetroArch save folder again.");
      }
    }
  }

  void pick(DocumentFile dir) {
    if (dir == null) {
      toast("Folder unavailable.");
      return;
    }
    ArrayList<DocumentFile> list = new ArrayList<>();
    for (DocumentFile f : dir.listFiles())
      if (f.isDirectory() || (f.getName() != null && SaveRules.isSave(f.getName()))) list.add(f);
    list.sort(Comparator.comparing(f -> f.getName() == null ? "" : f.getName()));
    if (list.isEmpty()) {
      toast("No .srm or .sav files here. Choose RetroArch’s Save Files folder.");
      return;
    }
    String[] names = new String[list.size()];
    for (int i = 0; i < names.length; i++)
      names[i] = (list.get(i).isDirectory() ? "Folder: " : "") + list.get(i).getName();
    new AlertDialog.Builder(this)
        .setTitle("Select Unbound’s cartridge save")
        .setItems(
            names,
            (d, index) -> {
              DocumentFile f = list.get(index);
              if (f.isDirectory()) {
                pick(f);
                return;
              }
              Courier.prefs(this)
                  .edit()
                  .putString("saveUri", f.getUri().toString())
                  .putString("saveName", f.getName())
                  .remove("lastHash")
                  .commit();
              Courier.status(this, "Save selected. Ready to sync.");
              refreshStatus();
            })
        .setNegativeButton("Cancel", null)
        .show();
  }
}
