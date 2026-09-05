package dev.borrius.courier;

import static org.junit.Assert.*;

import org.junit.Test;

public class SaveRulesTest {
  @Test
  public void rejectsStatesAndWrongSizes() {
    assertFalse(SaveRules.isSave("Unbound.state"));
    assertTrue(SaveRules.isSave("Unbound.SRM"));
    assertFalse(SaveRules.stable(new byte[5], new byte[5]));
  }

  @Test
  public void changingSaveIsNotCaptured() {
    byte[] a = new byte[131072], b = a.clone();
    assertTrue(SaveRules.stable(a, b));
    b[400] = 1;
    assertFalse(SaveRules.stable(a, b));
  }

  @Test
  public void originOnlyHttps() {
    assertEquals("https://upload.example.com", SaveRules.origin("https://UPLOAD.example.com/"));
    for (String s :
        new String[] {
          "http://upload.example.com",
          "https://user:pass@example.com",
          "https://example.com/path",
          "https://example.com?token=123",
          "https://example.com:8443"
        }) {
      try {
        SaveRules.origin(s);
        fail(s);
      } catch (IllegalArgumentException expected) {
      }
    }
  }

  @Test
  public void hashKnownVector() throws Exception {
    assertEquals(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        SaveRules.hash(new byte[0]));
  }
}
