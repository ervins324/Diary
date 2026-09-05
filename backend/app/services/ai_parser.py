import json
from fastapi import HTTPException
from google import genai
from google.genai import types
from app.schemas.schedule import AiParseResponse

async def parse_schedule_image(image_bytes: bytes, filename: str, api_key: str) -> AiParseResponse:
    """
    Parses a schedule image using Gemini 2.0 Flash.
    """
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")
        
    client = genai.Client(api_key=api_key)
    
    system_instruction = (
        "You are an assistant that extracts school schedules from images. "
        "Return the parsed schedule as a JSON object matching this schema:\n"
        "{\n"
        '  "days": [\n'
        "    {\n"
        '      "day_of_week": int (1 for Monday, 7 for Sunday),\n'
        '      "day_name": string (e.g. "Monday"),\n'
        '      "lessons": [\n'
        "        {\n"
        '          "order": int (lesson number),\n'
        '          "subject_name": string,\n'
        '          "start_time": string (HH:MM format),\n'
        '          "end_time": string (HH:MM format),\n'
        '          "cabinet": string (optional, null if not present)\n'
        "        }\n"
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Ensure all output is strictly valid JSON."
    )
    
    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type='image/jpeg'),
                "Extract the schedule from this image and provide the structured JSON."
            ],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json"
            )
        )
        
        data = json.loads(response.text)
        return AiParseResponse.model_validate(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse image with Gemini: {str(e)}")
