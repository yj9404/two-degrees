import json

from utils.gemini import get_ai_recommendations


class _FakeModels:
    def __init__(self, result_text):
        self._result_text = result_text
        self.last_contents = None

    def generate_content(self, model, contents, config):
        self.last_contents = contents

        class _Resp:
            pass

        resp = _Resp()
        resp.text = self._result_text
        return resp


class _FakeClient:
    def __init__(self, result_text):
        self.models = _FakeModels(result_text)


def test_get_ai_recommendations_maps_label_back_to_real_uuid(monkeypatch):
    """
    Gemini는 실제 UUID 대신 짧은 라벨(B1, B2, ...)을 받아 그 라벨로만 응답해야 하며,
    get_ai_recommendations는 응답의 라벨을 실제 candidate_id(UUID)로 되돌려야 한다.
    """
    real_id_1 = "11111111-1111-1111-1111-111111111111"
    real_id_2 = "22222222-2222-2222-2222-222222222222"

    fake_response = json.dumps([
        {"candidate_id": "B2", "score": 70, "reason": "두 번째 후보 추천 사유"},
        {"candidate_id": "B1", "score": 90, "reason": "첫 번째 후보 추천 사유"},
    ])
    fake_client = _FakeClient(fake_response)
    monkeypatch.setattr("utils.gemini._build_client", lambda: fake_client)

    target = {"id": "target-id"}
    candidates = [
        {"id": real_id_1},
        {"id": real_id_2},
    ]

    results = get_ai_recommendations(target, candidates)

    assert len(results) == 2
    # 프롬프트에는 실제 UUID가 아니라 라벨이 전달되어야 한다.
    assert real_id_1 not in fake_client.models.last_contents
    assert real_id_2 not in fake_client.models.last_contents

    # 응답은 실제 UUID로 매핑되어 돌아와야 하며 점수 내림차순으로 정렬되어야 한다.
    assert results[0]["candidate_id"] == real_id_1
    assert results[0]["score"] == 90
    assert results[1]["candidate_id"] == real_id_2
    assert results[1]["score"] == 70


def test_get_ai_recommendations_drops_unmatched_candidate_id(monkeypatch):
    """
    Gemini가 실제 요청에 없는 candidate_id(hallucination)를 반환하면
    해당 결과는 조용히 버려야 하고(매칭 불가), 나머지 정상 결과는 그대로 반환되어야 한다.
    """
    real_id = "33333333-3333-3333-3333-333333333333"

    fake_response = json.dumps([
        {"candidate_id": "B1", "score": 85, "reason": "정상 매칭"},
        {"candidate_id": "존재하지-않는-id", "score": 99, "reason": "환각된 매칭"},
    ])
    fake_client = _FakeClient(fake_response)
    monkeypatch.setattr("utils.gemini._build_client", lambda: fake_client)

    target = {"id": "target-id"}
    candidates = [{"id": real_id}]

    results = get_ai_recommendations(target, candidates)

    assert len(results) == 1
    assert results[0]["candidate_id"] == real_id
    assert results[0]["score"] == 85
