package dev.borrius.courier;

import android.content.Context;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

public final class SyncWorker extends Worker {
  public SyncWorker(Context c, WorkerParameters p) {
    super(c, p);
  }

  @Override
  public Result doWork() {
    Context c = getApplicationContext();
    try {
      return Courier.sync(c) ? Result.retry() : Result.success();
    } catch (Courier.AuthError e) {
      Courier.prefs(c).edit().putBoolean("revoked", true).remove("token").remove("iv").commit();
      Courier.status(c, "Access rejected. Generate a new pairing code on your dashboard.");
      return Result.failure();
    } catch (SecurityException e) {
      Courier.status(c, "Save access expired. Choose the folder and file again.");
      return Result.failure();
    } catch (Exception e) {
      Courier.status(
          c,
          e instanceof java.io.IOException
              ? e.getMessage()
              : "Sync interrupted. Your queued snapshots are safe; retrying.");
      return Result.retry();
    }
  }
}
