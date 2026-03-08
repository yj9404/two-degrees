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
        "당신은 최고의 확률을 자랑하는 전문 소개팅 주선자입니다. "
        "전달되는 데이터에는 사진이 제외되어 있으나, 후보자들의 '자기소개(intro), 선호 연령대(age_preference), "
        "음주 및 흡연 여부(drinking_status, smoking_status)', 기본 스펙(직업, 지역 등)을 종합적으로 분석하십시오. "
        "**[필수 준수 사항]**\n"
        "1. **원문 인용 금지**: 사용자가 작성한 자기소개나 조건 문구를 그대로 따옴표로 인용하거나 똑같이 옮기지 마십시오. "
        "사용자의 입력값에서 '맥락'과 '성향'만 파악하여 주선자의 언어로 완전히 재구성하십시오.\n"
        "2. **호칭 제한**: 추천 사유 작성 시 '타겟 유저', '후보 유저', '후보님', '상대방'과 같은 대상을 구분하는 명칭을 사용하지 마십시오. "
        "대신 '두 분은 ~한 점이 닮아 계시고', '~한 가치관을 공유하고 있어'와 같이 두 사람의 조화를 설명하는 자연스러운 3인칭 문장을 사용하십시오.\n"
        "3. **논리적 설득력**: 단순히 조건 일치를 나열하는 것이 아니라, 두 사람의 라이프스타일이 어떻게 시너지를 낼지 주선자가 옆에서 들려주는 듯한 문체로 작성하십시오."
    )
    
    # 프롬프트 구성
    prompt = (
        f"타겟 유저:\n{json.dumps(target_user, ensure_ascii=False, indent=2)}\n\n"
        f"후보 유저들:\n{json.dumps(candidates, ensure_ascii=False, indent=2)}\n\n"
        "위 후보 유저들에 대해, 타겟 유저와의 적합도를 평가해주세요.\n"
        "다음과 같은 스키마의 JSON 배열 형태로 결과만 반환해야 합니다:\n"
        "- '타겟'이나 '후보'라는 단어를 일절 쓰지 마십시오.\n"
        "- 사용자의 원문을 복사 붙여넣기 하지 마십시오.\n"
        "- 주선자가 두 사람에게 동시에 보여주어도 어색하지 않은 '추천 코멘트' 형식으로 작성하십시오.\n\n"
        "[\n"
        "  {\n"
        '    "candidate_id": "후보의 UUID (반드시 후보의 id와 정확히 일치해야 함)",\n'
        '    "score": 정수 (0~100 사이, 적합도 점수),\n'
        '    "reason": "이 두 사람이 잘 맞는 이유와 소개팅 제안 시 사용할 3~4줄의 추천 멘트 (호칭 주의, 원문 인용 금지)"\n'
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
