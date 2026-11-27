package ht.uniemuso.app;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Lecture des boîtes de notification UNIE-MUSO sur Firestore (API REST), sans dépendance Android :
 * testable sur PC contre l'émulateur Firebase.
 * Chaque passage lit seulement le champ « last » de ses boîtes (1 lecture par boîte) ;
 * les événements ne sont lus que lorsqu'une boîte a changé.
 */
public class PushCore {
    public interface Host {
        void show(String title, String body);
        boolean appVisible();
        String load(String key);
        void save(String key, String value);
        void log(String msg);
    }

    static final long DAY_DELAY = 90_000L;          // 6 h - 22 h
    static final long NIGHT_DELAY = 10 * 60_000L;   // 22 h - 6 h
    static final long ERROR_DELAY = 3 * 60_000L;

    private final Host host;
    private final String apiKey, projectId, email, pwd, me, authBase, fsBase;
    private final List<String> boxes = new ArrayList<>();
    private String idToken = null;
    private long tokenUntil = 0;
    private final LinkedHashSet<String> recent = new LinkedHashSet<>();

    public PushCore(JSONObject conf, Host host) {
        this.host = host;
        apiKey = conf.optString("apiKey");
        projectId = conf.optString("projectId");
        email = conf.optString("email");
        pwd = conf.optString("pwd");
        me = conf.optString("me");
        String a = conf.optString("authBase"), f = conf.optString("fsBase");
        authBase = a.isEmpty() ? "https://identitytoolkit.googleapis.com" : a;
        fsBase = f.isEmpty() ? "https://firestore.googleapis.com" : f;
        JSONArray b = conf.optJSONArray("boxes");
        if (b != null) for (int i = 0; i < b.length(); i++) if (!b.optString(i).isEmpty()) boxes.add(b.optString(i));
        for (String e : host.load("recent").split(",")) if (!e.isEmpty()) recent.add(e);
    }

    /** Un passage complet ; renvoie le délai avant le prochain (ms). */
    public long tick() {
        try {
            ensureToken();
            JSONObject last = readLast();
            boolean visible = host.appVisible();
            for (String box : boxes) {
                long l = last.optLong(box, 0);
                String k = "seen_" + box;
                String s = host.load(k);
                if (s.isEmpty()) { host.save(k, String.valueOf(l)); continue; } // 1er passage : pas d'historique
                long seen = Long.parseLong(s);
                if (l <= seen) continue;
                // Application à l'écran : elle affiche elle-même ; on avance seulement le repère
                if (!visible) for (JSONObject ev : readEvents(box, seen)) {
                    String eid = ev.optString("eid"), by = ev.optString("by");
                    if (!eid.isEmpty() && !recent.add(eid)) continue;
                    if (by.equals(me)) continue;
                    host.show(ev.optString("t", "UNIE-MUSO"), ev.optString("b"));
                }
                host.save(k, String.valueOf(l));
            }
            trimRecent();
            return delayNow();
        } catch (HttpError e) {
            if (e.code == 401 || e.code == 403) idToken = null;
            host.log("HTTP " + e.code + " " + e.getMessage());
            return ERROR_DELAY;
        } catch (Exception e) {
            host.log(String.valueOf(e));
            return ERROR_DELAY;
        }
    }

    static long delayNow() {
        int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        return (h >= 22 || h < 6) ? NIGHT_DELAY : DAY_DELAY;
    }

    private void trimRecent() {
        while (recent.size() > 60) recent.remove(recent.iterator().next());
        host.save("recent", String.join(",", recent));
    }

    private void ensureToken() throws Exception {
        if (idToken != null && System.currentTimeMillis() < tokenUntil) return;
        JSONObject body = new JSONObject().put("email", email).put("password", pwd).put("returnSecureToken", true);
        JSONObject r = new JSONObject(http(authBase + "/v1/accounts:signInWithPassword?key=" + apiKey, body.toString(), false));
        idToken = r.getString("idToken");
        tokenUntil = System.currentTimeMillis() + (Long.parseLong(r.optString("expiresIn", "3600")) - 300) * 1000L;
    }

    private String docRoot() { return "projects/" + projectId + "/databases/(default)/documents"; }

    /** { boîte : last } — une seule requête pour toutes les boîtes, champ « last » seulement. */
    private JSONObject readLast() throws Exception {
        JSONArray docs = new JSONArray();
        for (String b : boxes) docs.put(docRoot() + "/notifs/" + b);
        JSONObject body = new JSONObject().put("documents", docs).put("mask", new JSONObject().put("fieldPaths", new JSONArray().put("last")));
        JSONArray res = new JSONArray(http(fsBase + "/v1/" + docRoot() + ":batchGet", body.toString(), true));
        JSONObject out = new JSONObject();
        for (int i = 0; i < res.length(); i++) {
            JSONObject f = res.getJSONObject(i).optJSONObject("found");
            if (f == null) continue;
            String name = f.getString("name");
            out.put(name.substring(name.lastIndexOf('/') + 1), num(f.optJSONObject("fields"), "last"));
        }
        return out;
    }

    private List<JSONObject> readEvents(String box, long after) throws Exception {
        JSONObject q = new JSONObject()
                .put("from", new JSONArray().put(new JSONObject().put("collectionId", "ev")))
                .put("where", new JSONObject().put("fieldFilter", new JSONObject()
                        .put("field", new JSONObject().put("fieldPath", "at"))
                        .put("op", "GREATER_THAN")
                        .put("value", new JSONObject().put("integerValue", String.valueOf(after)))))
                .put("orderBy", new JSONArray().put(new JSONObject().put("field", new JSONObject().put("fieldPath", "at")).put("direction", "ASCENDING")))
                .put("limit", 10);
        JSONArray res = new JSONArray(http(fsBase + "/v1/" + docRoot() + "/notifs/" + box + ":runQuery",
                new JSONObject().put("structuredQuery", q).toString(), true));
        List<JSONObject> out = new ArrayList<>();
        for (int i = 0; i < res.length(); i++) {
            JSONObject d = res.getJSONObject(i).optJSONObject("document");
            if (d == null) continue;
            JSONObject f = d.optJSONObject("fields"); if (f == null) continue;
            JSONObject ev = new JSONObject();
            ev.put("at", num(f, "at"));
            for (String k : new String[]{"t", "b", "by", "eid"}) {
                JSONObject v = f.optJSONObject(k);
                ev.put(k, v == null ? "" : v.optString("stringValue"));
            }
            out.add(ev);
        }
        return out;
    }

    static long num(JSONObject fields, String k) {
        if (fields == null) return 0;
        JSONObject v = fields.optJSONObject(k);
        if (v == null) return 0;
        if (v.has("integerValue")) return Long.parseLong(v.optString("integerValue", "0"));
        if (v.has("doubleValue")) return (long) v.optDouble("doubleValue", 0);
        return 0;
    }

    static class HttpError extends Exception {
        final int code;
        HttpError(int code, String msg) { super(msg); this.code = code; }
    }

    private String http(String url, String body, boolean auth) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        if (auth) c.setRequestProperty("Authorization", "Bearer " + idToken);
        try (OutputStream o = c.getOutputStream()) { o.write(body.getBytes(StandardCharsets.UTF_8)); }
        int code = c.getResponseCode();
        InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (in != null) { byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) out.write(buf, 0, n); in.close(); }
        String text = new String(out.toByteArray(), StandardCharsets.UTF_8);
        c.disconnect();
        if (code >= 400) throw new HttpError(code, text.length() > 200 ? text.substring(0, 200) : text);
        return text;
    }
}
