package dev.borrius.courier;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class Vault {
  static SecretKey key() throws Exception {
    KeyStore s = KeyStore.getInstance("AndroidKeyStore");
    s.load(null);
    if (!s.containsAlias("borrius-token")) {
      KeyGenerator g = KeyGenerator.getInstance("AES", "AndroidKeyStore");
      g.init(
          new KeyGenParameterSpec.Builder(
                  "borrius-token", KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
              .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
              .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
              .build());
      g.generateKey();
    }
    return (SecretKey) s.getKey("borrius-token", null);
  }

  static void put(Context c, String token) throws Exception {
    Cipher x = Cipher.getInstance("AES/GCM/NoPadding");
    x.init(Cipher.ENCRYPT_MODE, key());
    Courier.prefs(c)
        .edit()
        .putString(
            "token",
            Base64.encodeToString(
                x.doFinal(token.getBytes(java.nio.charset.StandardCharsets.UTF_8)), Base64.NO_WRAP))
        .putString("iv", Base64.encodeToString(x.getIV(), Base64.NO_WRAP))
        .commit();
  }

  static String get(Context c) throws Exception {
    String t = Courier.prefs(c).getString("token", "");
    if (t.isEmpty()) return "";
    Cipher x = Cipher.getInstance("AES/GCM/NoPadding");
    x.init(
        Cipher.DECRYPT_MODE,
        key(),
        new GCMParameterSpec(
            128, Base64.decode(Courier.prefs(c).getString("iv", ""), Base64.NO_WRAP)));
    return new String(
        x.doFinal(Base64.decode(t, Base64.NO_WRAP)), java.nio.charset.StandardCharsets.UTF_8);
  }
}
