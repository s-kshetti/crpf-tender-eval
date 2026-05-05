from groq import Groq
import json, os
from dotenv import load_dotenv
load_dotenv()

client = Groq(api_key=os.getenv('GROQ_API_KEY'))

VALUE_PROMPT = '''
You are reviewing a bidder's document to check one specific criterion.

CRITERION: {criterion_description}
CRITERION TYPE: {criterion_type}
LOOKING FOR: {proof_required}

BIDDER DOCUMENT TEXT:
{document_text}

Extract the relevant value for this criterion from the document.
Return ONLY JSON with these fields:
- value: the extracted value as a string (null if not found)
- value_numeric: numeric value in base units (INR paise, or count) or null
- confidence: 0.0 to 1.0 (how confident you are in the extraction)
- page_reference: approximate location in document
- reason: one sentence explaining what you found or why you couldn't extract

If the document text is illegible or incomplete, set confidence below 0.5.
Return ONLY valid JSON. No explanation. No markdown.
'''

class ValueExtractor:
    def extract(self, document_text: str, criterion: dict) -> dict:
        prompt = VALUE_PROMPT.replace('{criterion_description}', criterion['description'])
        prompt = prompt.replace('{criterion_type}', criterion['type'])
        prompt = prompt.replace('{proof_required}', criterion['proof_required'])
        prompt = prompt.replace('{document_text}', document_text[:6000])

        response = client.chat.completions.create(
            model='llama-3.3-70b-versatile',
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=500,
            timeout=30.0
        )

        raw = response.choices[0].message.content.strip()
        if raw.startswith('```'):
            raw = raw.split('```')[1]
            if raw.startswith('json'):
                raw = raw[4:]

        return json.loads(raw)