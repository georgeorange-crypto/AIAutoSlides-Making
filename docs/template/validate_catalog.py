#!/usr/bin/env python3
"""Validate research-only official catalog. No network calls or downloads."""
import json,sys,re
from pathlib import Path
path=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).parent/'official-template-catalog.json'
doc=json.loads(path.read_text(encoding='utf-8'))
ids=set()
for x in doc['templates']:
    for key in ['template_id','institution','official_url','format','license_summary','official_status','trial_state']:
        assert x.get(key), (x.get('template_id'),key)
    assert x['template_id'] not in ids, x['template_id']
    ids.add(x['template_id'])
    assert x['official_url'].startswith('https://'),x['official_url']
    assert x['official_status'] in ('verified_official','official_but_license_unclear','third_party_reference_only','unverified','unavailable')
    assert x['quality_score'] is None or 1<=x['quality_score']<=5
    if x['official_status']=='official_but_license_unclear':
        assert x['integration_recommendation']!='eligible_distributable_brand_template',x['template_id']
print(f'OK: {len(ids)} catalog entries validated (metadata only)')
