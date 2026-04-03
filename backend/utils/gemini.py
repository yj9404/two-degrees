"""
gemini.py
Gemini API 연동 유틸리티
"""

import os
import json
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

try:
    from google import genai
except ImportError:
    genai = None

def get_ai_recommendations(target_user: Dict[str, Any], candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    타겟 유저와 후보 유저 리스트를 받아 Gemini API를 통해 각각의 적합도 점수와 추천 사유를 반환합니다.
    """
    if genai is None:
        raise RuntimeError("google-genai 패키지가 설치되지 않았습니다.")
        
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")
        
    client = genai.Client(api_key=api_key)
    
    system_instruction = (
        "당신은 최고의 매칭 확률을 자랑하는 TwoDegrees의 전문 소개팅 주선자입니다. "
        "전달되는 '기준 유저(User A)'와 여러 '상대 유저(User B)들'의 데이터를 쌍방향으로 분석하여 적합도를 평가하십시오.\n\n"
        "**[Part 1: 🌟 쌍방향(대칭형) 평가 및 점수 산출 규칙 - 매우 중요]**\n"
        "1. 쌍방향 부합도 체크: 반드시 다음 두 가지를 모두 평가한 뒤 종합 점수를 내십시오.\n"
        "   - User A의 '원하는 조건'과 '기피 조건'에 User B가 잘 맞는가?\n"
        "   - User B의 '원하는 조건'과 '기피 조건'에 User A가 잘 맞는가?\n"
        "   - 어느 한쪽이라도 상대방의 '기피 조건'에 해당되면 점수를 대폭 삭감하십시오.\n"
        "2. 가치관 매칭: marriage_intent(결혼 의향)와 child_plan(자녀 계획)이 일치하거나 보완적이면 가산점을, 명백히 상충하면 점수를 크게 삭감하십시오. 단, 값이 'UNKNOWN'인 경우 감점 요인으로 쓰지 마십시오.\n"
        "3. 사내연애 방지: 두 사람의 직장(company)이 같으면 절대 가산점을 주지 마십시오. 직종(job)은 비슷하되 직장이 다른 경우를 더 높게 평가하십시오.\n"
        "4. MBTI 활용: MBTI가 같거나 대중적인 궁합이 좋다는 이유만으로 가산점을 주지 마십시오. 특정 성향 기피/선호를 명시한 경우에만 반영하십시오.\n\n"
        "**[Part 2: 추천 사유(reason) 작성 가이드 - 핵심]**\n"
        "작성되는 텍스트는 유저가 상대방의 프로필을 열었을 때 가장 먼저 읽게 되는 '주선자의 강력한 추천 편지'입니다. 유저가 건조한 스펙을 따지기 전에 호감을 느낄 수 있도록, 감성적이고 호기심을 유발하는 스토리텔링 방식으로 작성하십시오.\n"
        "1. 스펙 나열 원천 금지: 데이터에 이미 있는 1차원적인 스펙(나이, 키, 직장명 등)을 텍스트에 절대 그대로 나열하지 마십시오.\n"
        "2. 원문 인용 금지: 사용자의 자기소개나 조건 문구를 따옴표로 복사하지 마십시오. 주선자의 언어로 소화하여 표현하십시오.\n"
        "3. 호칭 제한: '타겟', '후보', '기준 유저' 같은 단어 대신 '두 분은~', '함께 시간을 보내시면~'과 같이 자연스러운 3인칭 화법을 사용하십시오.\n"
        "4. 시너지와 라이프스타일 묘사: 단순한 조건 일치가 아니라, 두 사람의 대화 코드, 성향이 서로에게 어떻게 상호 보완적인 시너지를 낼지 묘사하십시오.\n"
        "5. 완곡하고 따뜻한 톤: 가치관이 일치할 때 '미래를 그리는 방향성이 닮아있어 깊은 대화를 나누기에 좋은 짝입니다' 등으로 부드럽게 표현하십시오."
    )
    
    # 프롬프트 구성
    prompt = (
        f"기준 유저 (User A):\n{json.dumps(target_user, ensure_ascii=False, indent=2)}\n\n"
        f"상대 유저들 (User B 목록):\n{json.dumps(candidates, ensure_ascii=False, indent=2)}\n\n"
        "위 상대 유저들(User B) 각각에 대해, 기준 유저(User A)와의 '쌍방향 적합도'를 평가해주세요.\n"
        "다음과 같은 스키마의 JSON 배열 형태로 결과만 반환해야 합니다:\n"
        "- '기준 유저', '상대 유저', '타겟', '후보' 등의 단어를 답변에 일절 쓰지 마십시오.\n"
        "- 사용자의 원문을 복사 붙여넣기 하지 마십시오.\n"
        "- 주선자가 두 사람에게 동시에 보여주어도 어색하지 않은 '추천 코멘트' 형식으로 작성하십시오.\n\n"
        "[\n"
        "  {\n"
        '    "candidate_id": "상대 유저의 UUID (반드시 상대방의 id와 정확히 일치해야 함)",\n'
        '    "score": 정수 (0~100 사이, 쌍방향 평가 종합 적합도 점수),\n'
        '    "reason": "이 두 사람이 잘 맞는 이유와 소개팅 제안 시 사용할 3~4줄의 추천 멘트 (상호 시너지 위주 작성)"\n'
        "  }\n"
        "]"
    )

    try:
        # 모델 생성 및 콘텐츠 생성 (Gemini 2.5 Flash)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "system_instruction": system_instruction,
                "response_mime_type": "application/json",
            }
        )
        
        result_text = response.text

        # 반환된 텍스트 파싱
        results = json.loads(result_text)
        if not isinstance(results, list):
            # 단일 객체일 경우 배열로 변환
            if isinstance(results, dict) and 'candidate_id' in results:
                results = [results]
            else:
                results = []
                
        # 점수 높은 순으로 내림차순 정렬
        results.sort(key=lambda x: x.get("score", 0), reverse=True)
        return results
    except Exception as e:
        logger.error(f"Gemini API 호출 중 에러 발생: {e}")
        return []
