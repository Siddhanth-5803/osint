"""Phone intelligence — fully offline, factual parsing via libphonenumber metadata.

This does NOT call anyone, ping the number, or look up the subscriber. It derives
only what the number itself encodes: validity, region, carrier band, line type,
timezones. That is non-invasive and reveals nothing private about the owner.
"""
from __future__ import annotations

import phonenumbers
from phonenumbers import carrier, geocoder, timezone, number_type, PhoneNumberType

from ..model import Target

_TYPE = {
    PhoneNumberType.MOBILE: "mobile",
    PhoneNumberType.FIXED_LINE: "fixed_line",
    PhoneNumberType.FIXED_LINE_OR_MOBILE: "fixed_or_mobile",
    PhoneNumberType.TOLL_FREE: "toll_free",
    PhoneNumberType.VOIP: "voip",
    PhoneNumberType.PREMIUM_RATE: "premium_rate",
    PhoneNumberType.UNKNOWN: "unknown",
}


def collect(raw: str, default_region: str = "IN", *, enrich: bool = True) -> Target:
    t = Target(kind="phone", value=raw)
    try:
        num = phonenumbers.parse(raw, default_region)
    except phonenumbers.NumberParseException as e:
        t.errors.append(f"parse error: {e}")
        return t

    valid = phonenumbers.is_valid_number(num)
    possible = phonenumbers.is_possible_number(num)
    src = "offline:libphonenumber"

    t.add("valid", valid, src, 95)
    t.add("possible", possible, src, 95)
    e164 = phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)
    t.add("e164", e164, src, 95)
    t.add("international",
          phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.INTERNATIONAL), src, 95)
    t.add("country_code", num.country_code, src, 95)
    t.add("national_number", num.national_number, src, 95)

    region = geocoder.description_for_number(num, "en")
    t.add("region", region, src, 80)
    car = carrier.name_for_number(num, "en")
    t.add("carrier", car, src, 70, note="original allocation; may differ after porting")
    t.add("line_type", _TYPE.get(number_type(num), "unknown"), src, 80)
    tzs = list(timezone.time_zones_for_number(num))
    t.add("timezones", tzs, src, 75)

    # search-pivot variants (formats an investigator/connectors can cross-reference)
    national = phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.NATIONAL)
    variants = sorted({e164, e164.lstrip("+"), str(num.national_number), national,
                       national.replace(" ", "").replace("-", "")})
    t.add("search_variants", variants, "offline:derive", 60,
          note="alternate formats for cross-referencing")

    if enrich:
        # BYO providers (off by default -> honest "not configured"); + manual leads
        from ..providers import phone_enrichment, phone_manual_leads
        for key, value, source, conf, note in phone_enrichment(e164) + phone_manual_leads(e164):
            t.add(key, value, source, conf, note)
    return t
