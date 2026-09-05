package dev.borrius.courier;

import java.net.URI;
import java.security.MessageDigest;
import java.util.Locale;

public final class SaveRules {
  public static boolean isSave(String name) {
    String n = name.toLowerCase(Locale.ROOT);
    return n.endsWith(".srm") || n.endsWith(".sav");
  }

  public static String origin(String url) {
    URI u = URI.create(url.trim());
    if (!"https".equalsIgnoreCase(u.getScheme())
        || u.getHost() == null
        || u.getRawUserInfo() != null
        || u.getRawQuery() != null
        || u.getRawFragment() != null
        || (u.getPort() != -1 && u.getPort() != 443))
      throw new IllegalArgumentException("Use the HTTPS upload origin from your dashboard.");
    if (u.getPath() != null && !u.getPath().isEmpty() && !u.getPath().equals("/"))
      throw new IllegalArgumentException("Enter the upload origin without a path.");
    return "https://" + u.getHost().toLowerCase(Locale.ROOT);
  }

  public static String hash(byte[] bytes) throws Exception {
    byte[] h = MessageDigest.getInstance("SHA-256").digest(bytes);
    StringBuilder s = new StringBuilder();
    for (byte b : h) s.append(String.format("%02x", b));
    return s.toString();
  }

  public static boolean stable(byte[] first, byte[] second) {
    return first.length == 131072 && MessageDigest.isEqual(first, second);
  }
}
