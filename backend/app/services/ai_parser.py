import json
import logging
from fastapi import HTTPException
from google import genai
from google.genai import types, errors
from app.schemas.schedule import AiParseResponse

logger = logging.getLogger(__name__)


async def parse_schedule_image(
    image_bytes: bytes,
    filename: str,
    api_key: str,
    content_type: str | None = None,
) -> AiParseResponse:
    """
    Parses a schedule image using Gemini 3.5 Flash.
    """
    if not api_key:
        logger.error("AI parse aborted: GEMINI_API_KEY is not configured")
        raise HTTPException(
            status_code=503,
            detail="Gemini API key not configured. Please set GEMINI_API_KEY in your .env file."
        )

    if not image_bytes or len(image_bytes) == 0:
        logger.error("AI parse aborted: Uploaded image payload is empty (0 bytes)")
        raise HTTPException(status_code=400, detail="Uploaded image file is empty")

    # Initialize Google GenAI client with provided API key
    client = genai.Client(api_key=api_key)

    # Determine mime type from content_type or filename
    mime_type = "image/jpeg"
    if content_type and content_type.startswith("image/"):
        mime_type = content_type
    elif filename:
        lower = filename.lower()
        if lower.endswith(".png"):
            mime_type = "image/png"
        elif lower.endswith(".webp"):
            mime_type = "image/webp"
        elif lower.endswith(".gif"):
            mime_type = "image/gif"
        elif lower.endswith((".jpg", ".jpeg")):
            mime_type = "image/jpeg"

    logger.info(
        f"Calling Gemini 3.5 Flash for image parse: "
        f"filename='{filename}', mime_type='{mime_type}', size={len(image_bytes)} bytes"
    )

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
        '          "order": int (lesson number, starting at 1),\n'
        '          "subject_name": string,\n'
        '          "start_time": string (HH:MM format, or null if not visible in image),\n'
        '          "end_time": string (HH:MM format, or null if not visible in image),\n'
        '          "cabinet": string (optional, null if not present)\n'
        "        }\n"
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "If exact times are not visible in the timetable, set start_time and end_time to null. "
        "Ensure all output is strictly valid JSON."
    )

    try:
        # Generate structured JSON output with automatic function calling disabled
        # to avoid the SDK warning regarding AFC in Models.generate_content
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                "Extract the schedule from this image and provide the structured JSON.",
            ],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                # Explicitly disable automatic function calling (AFC) since no tools are used,
                # preventing the warning in Models.generate_content
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            ),
        )
    except errors.APIError as e:
        logger.error(f"Gemini API returned error code {e.code}: {e.message}", exc_info=True)
        # Map to corresponding HTTP status code
        status_code = e.code if e.code in (400, 401, 403, 404, 429, 503) else 502
        raise HTTPException(
            status_code=status_code,
            detail=f"Gemini API error ({e.code}): {e.message}",
        )
    except Exception as e:
        logger.exception(f"Unexpected connection or client error calling Gemini: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Failed to communicate with Gemini API: {str(e)}",
        )

    # Sanitize and parse JSON response from Gemini
    try:
        raw_text = response.text.strip() if response.text else ""
        logger.info(f"Received Gemini response ({len(raw_text)} chars)")
        logger.debug(f"Gemini response snippet: {raw_text[:300]}")

        # Strip markdown code blocks if the model wrapped the JSON output
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()

        data = json.loads(raw_text)
        validated = AiParseResponse.model_validate(data)
        logger.info(f"Successfully validated schedule: parsed {len(validated.days)} day(s)")
        return validated
    except json.JSONDecodeError as e:
        logger.error(
            f"Failed to decode JSON from Gemini output: {e}. Raw response was: {response.text}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=502,
            detail=f"Gemini did not return valid JSON: {str(e)}. Raw text: {response.text[:200]}",
        )
    except Exception as e:
        logger.exception(f"Schema validation failed on Gemini schedule output: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to validate parsed schedule schema: {str(e)}",
        )
