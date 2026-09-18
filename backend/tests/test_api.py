"""The API end to end, with image analysis and the chat model replaced. No network."""

from types import SimpleNamespace

from routes import chat

from .conftest import finding


def upload(client, path="/api/inspect", **extra):
    return client.post(path, files={"file": ("part.jpg", b"fake image", "image/jpeg")}, data=extra)


def test_an_inspection_is_saved_and_listed(client, stub_analysis):
    stub_analysis.append(finding())
    r = upload(client, component_name="Left aileron")
    assert r.status_code == 200
    body = r.json()
    assert body["compliance_status"] == "grounded" and body["component_name"] == "Left aileron"

    listed = client.get("/api/inspections").json()
    assert len(listed) == 1 and listed[0]["defect_type"] == "corrosion"
    assert client.get(f"/api/inspections/{body['id']}").status_code == 200


def test_stats_count_compliance(client, stub_analysis):
    stub_analysis.extend([finding(), finding(found=False)])
    upload(client)
    upload(client)
    stats = client.get("/api/stats").json()
    assert stats["total_inspections"] == 2


def test_compare_returns_both_results_and_a_verdict(client, stub_analysis):
    stub_analysis.extend([finding(severity="medium"), finding(severity="critical")])
    r = client.post("/api/compare", files={"before_file": ("b.jpg", b"b", "image/jpeg"),
                                           "after_file": ("a.jpg", b"a", "image/jpeg")})
    assert r.status_code == 200 and r.json()["comparison"]["verdict"] == "worsened"


def test_chat_answers_about_the_inspection_and_sends_its_details(client, stub_analysis, monkeypatch):
    stub_analysis.append(finding())
    iid = upload(client, component_name="Nose gear bolt").json()["id"]
    sent = {}

    async def fake_create(**kwargs):
        sent.update(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="No, it is grounded."))])

    monkeypatch.setattr(chat.client.chat.completions, "create", fake_create)
    r = client.post("/api/chat", json={"inspection_id": iid, "message": "Can it fly?", "history": []})
    assert r.status_code == 200 and r.json()["response"] == "No, it is grounded."
    assert "Nose gear bolt" in sent["messages"][0]["content"]
    assert sent["extra_body"] == chat.FALLBACK
