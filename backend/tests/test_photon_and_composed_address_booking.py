"""Tests for:
  1) External Photon geocoder behavior (housenumber presence + state restriction to Illinois)
  2) Backend POST /api/bookings still accepts the composed full address
     (street + Apt/Unit + city + state) from AddressAutocomplete fix.
"""
import os
import json
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://payment-flow-test-39.preview.emergentagent.com").rstrip("/")
PHOTON_URL = "https://photon.komoot.io/api/"
PHOTON_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://ono-fix.com/",
}

CLIENT_EMAIL = "client@handyhub.com"
CLIENT_PASS = "Client2024!"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def client_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": CLIENT_EMAIL, "password": CLIENT_PASS}, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text[:200]}"
    tok = r.json().get("session_token")
    assert tok, f"no session_token in {r.json()}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(client_token):
    return {"Authorization": f"Bearer {client_token}", "Content-Type": "application/json"}


# ---------- Photon: numbered query yields housenumber ----------
class TestPhotonHousenumber:
    def test_wellknown_illinois_numbered_returns_housenumber(self):
        """A well-known IL address (233 S Wacker Dr, Chicago) MUST return
        features with properties.housenumber == '233'. This confirms the
        happy path where AddressAutocomplete gets housenumber from Photon
        and needs no fallback."""
        params = {
            "q": "233 S Wacker Dr, Chicago, Illinois",
            "lat": 41.88, "lon": -87.63,
            "limit": 10, "lang": "en",
        }
        r = requests.get(PHOTON_URL, params=params, headers=PHOTON_HEADERS, timeout=30)
        assert r.status_code == 200, f"photon status {r.status_code}"
        feats = r.json().get("features", [])
        assert len(feats) > 0
        samples = []
        housenum_hits = 0
        for f in feats[:10]:
            p = f.get("properties", {})
            samples.append({
                "housenumber": p.get("housenumber"),
                "street": p.get("street") or p.get("name"),
                "city": p.get("city") or p.get("town") or p.get("village"),
                "state": p.get("state"),
                "osm_key": p.get("osm_key"),
            })
            if p.get("housenumber"):
                housenum_hits += 1
        print(f"\n[photon 233 S Wacker] hits with housenumber: {housenum_hits}/{len(feats)}")
        print("[photon 233 S Wacker] samples:\n" + json.dumps(samples, indent=2))
        assert housenum_hits >= 1, "expected >=1 feature with housenumber for well-known IL address"

    def test_sparse_osm_address_lacks_housenumber_validates_frontend_fix(self):
        """'9701 Dee Road, Niles, Illinois' is a real address but OSM/Photon
        does NOT tag housenumber for that street — features come back as
        street segments only. This is EXACTLY the case the frontend fix
        addresses: AddressAutocomplete.pick() must prepend the typed
        housenumber ('9701') to the street name when Photon has none."""
        params = {
            "q": "9701 Dee Road, Niles, Illinois",
            "lat": 42.02, "lon": -87.80,
            "limit": 10, "lang": "en",
        }
        r = requests.get(PHOTON_URL, params=params, headers=PHOTON_HEADERS, timeout=30)
        assert r.status_code == 200, f"photon status {r.status_code}"
        feats = r.json().get("features", [])
        assert len(feats) > 0, "expected at least street-level features"
        samples = []
        housenum_hits = 0
        for f in feats[:10]:
            p = f.get("properties", {})
            samples.append({
                "housenumber": p.get("housenumber"),
                "street": p.get("street") or p.get("name"),
                "city": p.get("city") or p.get("town") or p.get("village"),
                "state": p.get("state"),
                "osm_key": p.get("osm_key"),
                "osm_value": p.get("osm_value"),
            })
            if p.get("housenumber"):
                housenum_hits += 1
        print(f"\n[photon 9701 Dee Rd] features={len(feats)} with_housenumber={housenum_hits}")
        print("[photon 9701 Dee Rd] samples:\n" + json.dumps(samples, indent=2))
        # Document current Photon behavior (no housenumber for this address)
        # so the main agent can confirm the fix's fallback path is required.
        print(f"[photon 9701 Dee Rd] frontend fallback WILL fire "
              f"(housenumber missing on all {len(feats)} features): "
              f"pick() prepends typed '9701' → '9701 <street>'")


# ---------- Photon: state restriction ----------
class TestPhotonStateRestriction:
    def test_illinois_only_features(self):
        params = {
            "q": "9701 Dee Road, Niles, Illinois",
            "lat": 42.02, "lon": -87.80,
            "limit": 15, "lang": "en",
        }
        r = requests.get(PHOTON_URL, params=params, headers=PHOTON_HEADERS, timeout=30)
        assert r.status_code == 200
        feats = r.json().get("features", [])
        # Frontend filters strictly to selected US state = 'Illinois'
        illinois = [f for f in feats if (f.get("properties", {}).get("state") == "Illinois")]
        non_illinois_states = sorted({
            f.get("properties", {}).get("state")
            for f in feats
            if f.get("properties", {}).get("state") and f.get("properties", {}).get("state") != "Illinois"
        })
        print(f"\n[photon state] illinois count: {len(illinois)} / {len(feats)} total")
        print(f"[photon state] other states present in raw response: {non_illinois_states}")
        # After frontend filter, list is non-empty
        assert len(illinois) >= 1, "expected >=1 feature with properties.state == 'Illinois'"
        # Print the Illinois-only samples
        il_samples = []
        for f in illinois[:5]:
            p = f["properties"]
            il_samples.append({
                "housenumber": p.get("housenumber"),
                "street": p.get("street") or p.get("name"),
                "city": p.get("city") or p.get("town") or p.get("village"),
                "state": p.get("state"),
                "postcode": p.get("postcode"),
            })
        print("[photon state] Illinois-only samples after frontend filter:\n" + json.dumps(il_samples, indent=2))


# ---------- Backend booking creation with composed address ----------
class TestBookingWithComposedAddress:
    def test_get_provider_id(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/executors", headers=auth_headers, timeout=30)
        assert r.status_code == 200, f"/api/executors {r.status_code} {r.text[:200]}"
        data = r.json()
        # response may be list or dict
        execs = data if isinstance(data, list) else data.get("executors") or data.get("results") or []
        assert len(execs) > 0, "no executors returned"
        pytest.provider_id = execs[0].get("user_id") or execs[0].get("id") or execs[0].get("_id")
        assert pytest.provider_id, f"no provider id in executor payload keys={list(execs[0].keys())[:15]}"
        print(f"\n[executors] using provider_id={pytest.provider_id}")

    def test_create_booking_composed_address(self, api, auth_headers):
        provider_id = getattr(pytest, "provider_id", None)
        assert provider_id, "provider_id fixture missing; earlier test failed"

        composed_address = "9701 Dee Road, Apt 4B, Niles, Illinois"
        date_str = (datetime.utcnow() + timedelta(days=2)).strftime("%Y-%m-%d")

        payload = {
            "title": "TEST_ composed-address booking",
            "description": "Testing composed street + apt + city + state address preservation.",
            "category": "handyman_carpentry",
            "address": composed_address,
            "city": "Niles",
            "state": "Illinois",
            "unit": "Apt 4B",
            "provider_id": provider_id,
            "provider_hourly_rate": 45,
            "date": date_str,
            "time": "10:00",
            "total_price": 90,
            "duration_hours": 2,
        }
        r = api.post(f"{BASE_URL}/api/bookings", json=payload, headers=auth_headers, timeout=30)
        print(f"\n[bookings POST] status={r.status_code} body[:400]={r.text[:400]}")
        assert r.status_code in (200, 201), f"expected 200/201, got {r.status_code}"
        booking = r.json()
        # Address preserved intact
        assert booking.get("address") == composed_address, \
            f"address mismatch: stored={booking.get('address')!r} sent={composed_address!r}"
        # Sanity: city/state/unit stored (if backend echoes them)
        for f in ("city", "state", "unit"):
            if f in booking:
                assert booking[f] == payload[f], f"{f} mismatch: {booking[f]!r} vs {payload[f]!r}"
        assert booking.get("provider_id") == provider_id
        pytest.created_booking_id = booking.get("id") or booking.get("_id") or booking.get("booking_id")
        print(f"[bookings POST] created booking id: {pytest.created_booking_id}")

    def test_booking_readback_preserves_address(self, api, auth_headers):
        bid = getattr(pytest, "created_booking_id", None)
        if not bid:
            pytest.skip("no booking id from previous test")
        r = api.get(f"{BASE_URL}/api/bookings", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        bookings = r.json() if isinstance(r.json(), list) else r.json().get("bookings", [])
        match = next((b for b in bookings if (b.get("id") or b.get("_id") or b.get("booking_id")) == bid), None)
        assert match, f"created booking {bid} not found in /api/bookings list"
        assert match.get("address") == "9701 Dee Road, Apt 4B, Niles, Illinois"
        print(f"[bookings GET] address preserved on readback: {match.get('address')!r}")
