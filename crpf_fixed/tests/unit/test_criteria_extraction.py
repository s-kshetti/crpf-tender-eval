from backend.extraction.criteria_extractor import CriteriaExtractor

def test_extract_criteria():
    with open('tests/mock_data/test_tender.txt') as f:
        tender_text = f.read()

    extractor = CriteriaExtractor()
    criteria = extractor.extract(tender_text)

    # Should find 4 criteria
    assert len(criteria) == 4

    # C1 should be financial and mandatory
    c1 = next(c for c in criteria if c['type'] == 'financial')
    assert c1['mandatory'] == True
    assert c1['threshold'] == 50000000

    print('All criteria extracted correctly!')
    for c in criteria:
        print(f'  {c["id"]}: {c["description"]}')

# Run with: python -m pytest tests/unit/test_criteria_extraction.py -v
