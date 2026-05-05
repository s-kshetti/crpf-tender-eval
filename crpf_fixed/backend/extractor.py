from dotenv import load_dotenv
from groq import Groq
import json
import os
load_dotenv()
client = Groq(api_key=os.getenv('GROQ_API_KEY'))

EXTRACTION_PROMPT = '''
You are a government procurement analyst reviewing a tender document.
Extract ALL eligibility criteria from the following text.

Return ONLY a JSON array. Each item must have:
- id: string like C1, C2, C3
- type: one of financial/technical/compliance/certification
- mandatory: true or false
- description: plain English description of the criterion
- threshold: numeric value or null
- unit: INR/count/years or null
- proof_required: what document proves this
- raw_text: the exact clause from the tender

TENDER TEXT:
{tender_text}

Return ONLY valid JSON. No explanation. No markdown.
'''

class CriteriaExtractor:
    def extract(self, tender_text: str) -> list[dict]:
        prompt = EXTRACTION_PROMPT.replace('{tender_text}', tender_text[:8000])

        response = client.chat.completions.create(
            model='llama-3.3-70b-versatile',
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=4000,
            timeout=60.0 
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown if present
        if raw.startswith('```'):
            raw = raw.split('```')[1]
            if raw.startswith('json'):
                raw = raw[4:]

        criteria = json.loads(raw)
        return criteria