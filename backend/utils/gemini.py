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
        "타겟 유저의 '기본조건, 원하는 조건, 기피 조건'과 후보들의 '기본조건, 원하는 조건, 기피 조건'을 교차 검증하여 "
        "가장 잘 맞는 상대를 찾아야 합니다."
    )
    
    # 프롬프트 구성
    prompt = (
        f"타겟 유저:\n{json.dumps(target_user, ensure_ascii=False, indent=2)}\n\n"
        f"후보 유저들:\n{json.dumps(candidates, ensure_ascii=False, indent=2)}\n\n"
        "위 후보 유저들에 대해, 타겟 유저와의 적합도를 평가해주세요.\n"
        "다음과 같은 스키마의 JSON 배열 형태로 결과만 반환해야 합니다:\n"
        "[\n"
        "  {\n"
        '    "candidate_id": "후보의 UUID (반드시 후보의 id와 정확히 일치해야 함)",\n'
        '    "score": 정수 (0~100 사이, 적합도 점수),\n'
        '    "reason": "이 두 사람이 잘 맞는 이유와 소개팅 제안 시 사용할 3~4줄의 추천 멘트"\n'
        "  }\n"
        "]"
    )
    
    logger.info("=== Gemini API Input Prompt ===")
    logger.info(prompt)
    logger.info("===============================")
    
    try:
        # 모델 생성 및 콘텐츠 생성 (Gemini 2.0 Flash)
        # 기존 2.5-flash는 존재하지 않는 버전으로 보여 2.0-flash로 수정 제안 (또는 최신 stable 버전)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "system_instruction": system_instruction,
                "response_mime_type": "application/json",
            }
        )
        
        result_text = response.text
        
        logger.info("=== Gemini API Output ===")
        logger.info(result_text)
        logger.info("=========================")
        
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
