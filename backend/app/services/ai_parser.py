import json
import logging
from fastapi import HTTPException
from google import genai
from google.genai import types, errors
from app.schemas.schedule import AiParseResponse
from app.schemas.bell_schedule import AiParseBellsResponse

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
        "Ти — асистент, який точно розпізнає та витягує шкільний розклад уроків зі зображень "
        "(фотографій, скріншотів розкладів, таблиць тощо).\n"
        "Поверни розпізнаний розклад уроків у вигляді JSON-об'єкта за такою схемою:\n"
        "{\n"
        '  "days": [\n'
        "    {\n"
        '      "day_of_week": int (1 для Понеділка, 2 для Вівторка, 3 для Середи, 4 для Четверга, 5 для П\'ятниці, 6 для Суботи, 7 для Неділі),\n'
        '      "day_name": string (наприклад, "Понеділок", "Вівторок", "Середа", "Четвер", "П\'ятниця", "Субота"),\n'
        '      "lessons": [\n'
        "        {\n"
        '          "order": int (порядковий номер уроку, починаючи з 1),\n'
        '          "subject_name": string (назва предмета, наприклад "Укр мова"),\n'
        '          "start_time": string (час початку у 24-годинному форматі HH:MM, наприклад "08:30", або null якщо час не вказано на зображенні),\n'
        '          "end_time": string (час закінчення у 24-годинному форматі HH:MM, наприклад "09:15", або null якщо час не вказано на зображенні),\n'
        '          "cabinet": string (номер кабінету чи аудиторії, якщо вказано, або null)\n'
        "        }\n"
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Обов'язкові вимоги:\n"
        "1. day_of_week: 1 (Пн), 2 (Вт), 3 (Ср), 4 (Чт), 5 (Пт), 6 (Сб). Завжди використовуй 24-годинний формат часу HH:MM (наприклад, 08:30, 11:25).\n"
        "2. Якщо точний час уроку відсутній або невідомий на зображенні, обов'язково встанови start_time і end_time як null (додаток автоматично візьме розклад дзвінків).\n"
        "3. Скорочуй довгі назви предметів: Укр мова, Укр літ, Англ мова, Фізра, Зар літ, Історія Укр, Інформатика, Геометрія, Алгебра, Біологія, Хімія, Фізика, Географія, Громадянська Освіта, Всес. Історія.\n"
        "4. Надай виключно чистий валідний JSON без зайвих слів."
    )

    try:
        # Generate structured JSON output with automatic function calling disabled
        # to avoid the SDK warning regarding AFC in Models.generate_content
        response = client.models.generate_content(
            model='gemini-3.8-flash',
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


async def parse_bells_image(
    image_bytes: bytes,
    filename: str,
    api_key: str,
    content_type: str | None = None,
) -> AiParseBellsResponse:
    """
    Parses a bell schedule image (розклад дзвінків) using Gemini 3.5 Flash.
    Extracts lesson numbers, start times, and end times.
    """
    if not api_key:
        logger.error("AI bells parse aborted: GEMINI_API_KEY is not configured")
        raise HTTPException(
            status_code=503,
            detail="Gemini API key not configured. Please set GEMINI_API_KEY in your .env file."
        )

    if not image_bytes or len(image_bytes) == 0:
        logger.error("AI bells parse aborted: Uploaded image payload is empty (0 bytes)")
        raise HTTPException(status_code=400, detail="Uploaded image file is empty")

    client = genai.Client(api_key=api_key)

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
        f"Calling Gemini 3.5 Flash for bells schedule parse: "
        f"filename='{filename}', mime_type='{mime_type}', size={len(image_bytes)} bytes"
    )

    system_instruction = (
        "Ти — асистент, який точно витягує розклад шкільних дзвінків (час початку та закінчення кожного уроку) "
        "зі зображень (фотографій розкладу дзвінків, оголошень, таблиць).\n"
        "Поверни розпізнаний розклад дзвінків у вигляді JSON-об'єкта за такою схемою:\n"
        "{\n"
        '  "slots": [\n'
        "    {\n"
        '      "order": int (порядковий номер уроку: 1, 2, 3...),\n'
        '      "start_time": string (час початку уроку у 24-годинному форматі HH:MM, наприклад "08:30"),\n'
        '      "end_time": string (час закінчення уроку у 24-годинному форматі HH:MM, наприклад "09:15"),\n'
        '      "name": string (назва, наприклад "1 урок", або null)\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Обов'язкові вимоги:\n"
        "1. Завжди використовуй 24-годинний формат часу (HH:MM, наприклад 08:30, 13:20). Без AM/PM.\n"
        "2. Сортуй уроки за зростанням номеру (order).\n"
        "3. Виводь виключно чистий валідний JSON без зайвих слів."
    )

    try:
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                "Extract the lesson bell schedule (start and end times for each lesson order) from this image and provide structured JSON.",
            ],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            ),
        )
    except errors.APIError as e:
        logger.error(f"Gemini API returned error code {e.code} during bells parse: {e.message}", exc_info=True)
        status_code = e.code if e.code in (400, 401, 403, 404, 429, 503) else 502
        raise HTTPException(
            status_code=status_code,
            detail=f"Gemini API error ({e.code}): {e.message}",
        )
    except Exception as e:
        logger.exception(f"Unexpected error calling Gemini for bells parse: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Failed to communicate with Gemini API: {str(e)}",
        )

    try:
        raw_text = response.text.strip() if response.text else ""
        logger.info(f"Received Gemini bells response ({len(raw_text)} chars)")

        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()

        data = json.loads(raw_text)
        validated = AiParseBellsResponse.model_validate(data)
        logger.info(f"Successfully validated bell schedule: parsed {len(validated.slots)} slot(s)")
        return validated
    except json.JSONDecodeError as e:
        logger.error(f"Failed to decode JSON from Gemini bells output: {e}. Raw: {response.text}", exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=f"Gemini did not return valid JSON for bell schedule: {str(e)}",
        )
    except Exception as e:
        logger.exception(f"Schema validation failed on Gemini bells output: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to validate bell schedule schema: {str(e)}",
        )

