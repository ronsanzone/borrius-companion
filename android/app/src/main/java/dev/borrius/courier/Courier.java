package dev.borrius.courier;

import android.content.*;
import android.net.*;
import android.util.AtomicFile;
import android.util.Base64;
import androidx.work.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.json.*;

final class Courier {
  static android.content.SharedPreferences prefs(Context c) {
    return c.getSharedPreferences("courier", 0);
  }

  static void status(Context c, String message) {
    prefs(c)
        .edit()
        .putString("status", message)
        .putString("checked", Instant.now().toString())
        .commit();
  }

  static void schedule(Context c) {
    WorkManager.getInstance(c)
        .enqueueUniquePeriodicWork(
            "save-sync",
            ExistingPeriodicWorkPolicy.UPDATE,
            new PeriodicWorkRequest.Builder(SyncWorker.class, 15, TimeUnit.MINUTES)
                .setConstraints(
                    new Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.UNMETERED)
                        .setRequiresBatteryNotLow(true)
                        .build())
                .build());
  }

  static void now(Context c) {
    WorkManager.getInstance(c)
        .enqueueUniqueWork(
            "save-now",
            ExistingWorkPolicy.REPLACE,
            new OneTimeWorkRequest.Builder(SyncWorker.class).build());
    status(c, "Sync requested…");
  }

  static boolean wifi(Context c) {
    ConnectivityManager m = (ConnectivityManager) c.getSystemService(Context.CONNECTIVITY_SERVICE);
    NetworkCapabilities n = m.getNetworkCapabilities(m.getActiveNetwork());
    return n != null
        && n.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
        && n.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
  }

  static byte[] read(InputStream in) throws Exception {
    if (in == null) throw new IOException("Unable to open save");
    try (InputStream s = in;
        ByteArrayOutputStream b = new ByteArrayOutputStream()) {
      byte[] chunk = new byte[8192];
      int n;
      while ((n = s.read(chunk)) != -1) {
        b.write(chunk, 0, n);
        if (b.size() > 262144) throw new IOException("Save is larger than expected");
      }
      return b.toByteArray();
    }
  }

  static File dir(Context c) {
    File d = new File(c.getFilesDir(), "pending");
    d.mkdirs();
    return d;
  }

  static void write(File f, JSONObject o) throws Exception {
    AtomicFile a = new AtomicFile(f);
    FileOutputStream s = a.startWrite();
    try {
      s.write(o.toString().getBytes(StandardCharsets.UTF_8));
      a.finishWrite(s);
    } catch (Exception e) {
      a.failWrite(s);
      throw e;
    }
  }

  static JSONObject json(File f) throws Exception {
    return new JSONObject(new String(read(new AtomicFile(f).openRead()), StandardCharsets.UTF_8));
  }

  static File[] pending(Context c) {
    File[] fs = dir(c).listFiles((d, n) -> n.endsWith(".json"));
    if (fs == null) return new File[0];
    Arrays.sort(fs, Comparator.comparing(File::getName));
    return fs;
  }

  static void capture(Context c) throws Exception {
    String uri = prefs(c).getString("saveUri", "");
    if (uri.isEmpty()) throw new IOException("Choose your Unbound save file first.");
    byte[] a = read(c.getContentResolver().openInputStream(Uri.parse(uri)));
    Thread.sleep(600);
    byte[] b = read(c.getContentResolver().openInputStream(Uri.parse(uri)));
    if (!SaveRules.stable(a, b))
      throw new IOException(
          "Save is changing or is not a 128 KB Unbound save. Try again after saving finishes.");
    String hash = SaveRules.hash(b);
    if (hash.equals(prefs(c).getString("lastHash", ""))) return;
    for (File f : pending(c))
      if (hash.equals(json(f).getString("hash"))) {
        prefs(c).edit().putString("lastHash", hash).commit();
        return;
      }
    if (pending(c).length >= 128)
      throw new IOException("128 snapshots are queued. Connect to Wi-Fi to upload them.");
    long sequence = prefs(c).getLong("sequence", 0) + 1;
    prefs(c).edit().putLong("sequence", sequence).commit();
    JSONObject o =
        new JSONObject()
            .put("captureId", UUID.randomUUID().toString())
            .put("sequence", sequence)
            .put("capturedAt", Instant.now().toString())
            .put("filename", prefs(c).getString("saveName", "Unbound.srm"))
            .put("hash", hash)
            .put("bytes", Base64.encodeToString(b, Base64.NO_WRAP));
    write(new File(dir(c), String.format(Locale.ROOT, "%020d.json", sequence)), o);
    prefs(c).edit().putString("lastHash", hash).commit();
  }

  static final class AuthError extends IOException {}

  static JSONObject request(
      String base, String path, String token, byte[] body, Map<String, String> extra)
      throws Exception {
    HttpURLConnection x =
        (HttpURLConnection) new URL(SaveRules.origin(base) + path).openConnection();
    x.setInstanceFollowRedirects(false);
    x.setConnectTimeout(15000);
    x.setReadTimeout(20000);
    try {
      if (!token.isEmpty()) x.setRequestProperty("Authorization", "Bearer " + token);
      if (extra != null)
        for (Map.Entry<String, String> e : extra.entrySet())
          x.setRequestProperty(e.getKey(), e.getValue());
      if (body != null) {
        x.setRequestMethod("POST");
        x.setDoOutput(true);
        x.setFixedLengthStreamingMode(body.length);
        try (OutputStream o = x.getOutputStream()) {
          o.write(body);
        }
      }
      int code = x.getResponseCode();
      if (code == 401 || code == 403) throw new AuthError();
      if (code < 200 || code >= 300)
        throw new IOException("Server returned HTTP " + code + ". Snapshot retained for retry.");
      return new JSONObject(new String(read(x.getInputStream()), StandardCharsets.UTF_8));
    } finally {
      x.disconnect();
    }
  }

  static synchronized void pair(Context c, String origin, String code) throws Exception {
    if (!wifi(c)) throw new IOException("Connect to Wi-Fi before pairing.");
    JSONObject result =
        request(
            origin,
            "/api/device/pair",
            "",
            new JSONObject()
                .put("code", code.trim())
                .put("name", "Retroid Pocket Classic")
                .toString()
                .getBytes(StandardCharsets.UTF_8),
            Collections.singletonMap("Content-Type", "application/json"));
    String returned = SaveRules.origin(result.optString("uploadUrl", origin));
    if (!returned.equals(SaveRules.origin(origin)))
      throw new IOException("Unexpected upload origin in pairing response.");
    for (File f : pending(c)) {
      JSONObject queued = json(f);
      queued.remove("receipt");
      queued.put("captureId", UUID.randomUUID().toString());
      write(f, queued);
    }
    Vault.put(c, result.getString("token"));
    prefs(c)
        .edit()
        .putString("origin", returned)
        .putString("deviceId", result.getString("deviceId"))
        .putBoolean("revoked", false)
        .commit();
    status(c, "Paired. Choose your save and sync.");
    schedule(c);
  }

  static synchronized boolean sync(Context c) throws Exception {
    if (prefs(c).getBoolean("revoked", false)) {
      status(c, "Device access revoked. Pair again from your dashboard.");
      return false;
    }
    if (Vault.get(c).isEmpty()) {
      status(c, "Pair with your dashboard first.");
      return false;
    }
    capture(c);
    if (!wifi(c)) {
      status(c, "Waiting for Wi-Fi · " + pending(c).length + " queued");
      return true;
    }
    String token = Vault.get(c), origin = prefs(c).getString("origin", "");
    boolean waiting = false;
    for (File f : pending(c)) {
      JSONObject o = json(f);
      String receipt = o.optString("receipt", "");
      JSONObject r;
      if (receipt.isEmpty()) {
        Map<String, String> h = new HashMap<>();
        h.put("Content-Type", "application/octet-stream");
        h.put("X-Capture-Id", o.getString("captureId"));
        h.put("X-Captured-At", o.getString("capturedAt"));
        h.put("X-Device-Sequence", o.getString("sequence"));
        h.put(
            "X-Save-Name",
            java.net.URLEncoder.encode(o.getString("filename"), "UTF-8").replace("+", "%20"));
        h.put("X-Game-Version", "2.1.1.1");
        r =
            request(
                origin,
                "/api/device/upload",
                token,
                Base64.decode(o.getString("bytes"), Base64.NO_WRAP),
                h);
        receipt = r.getString("id");
        o.put("receipt", receipt);
        write(f, o);
      } else
        r =
            request(
                origin,
                "/api/device/receipts/" + java.net.URLEncoder.encode(receipt, "UTF-8"),
                token,
                null,
                null);
      String state = r.getString("status");
      prefs(c).edit().putString("receipt", receipt).putString("receiptStatus", state).commit();
      if (state.equals("ready")) {
        if (!f.delete()) throw new IOException("Could not retire processed snapshot.");
        prefs(c).edit().putString("lastUploaded", o.getString("capturedAt")).commit();
      } else if (state.equals("failed")) {
        File failed = new File(c.getFilesDir(), "failed");
        failed.mkdirs();
        if (!f.renameTo(new File(failed, f.getName())))
          throw new IOException("Unable to archive failed snapshot.");
        status(c, "Save uploaded, but analysis failed. See dashboard details.");
        return false;
      } else waiting = true;
    }
    status(
        c,
        waiting
            ? "Uploaded · analysis pending"
            : prefs(c).getString("receiptStatus", "").equals("failed")
                ? "Last analysis failed. See dashboard details."
                : "Up to date · no unsent changes");
    return waiting;
  }
}
