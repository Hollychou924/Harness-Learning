from xml.etree import ElementTree as ET

NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

def discover_links_from_sitemap(sitemap_xml: str, keep_prefix: str) -> list[str]:
    """Parse sitemap.xml, return loc URLs that start with keep_prefix."""
    root = ET.fromstring(sitemap_xml)
    locs = [el.text.strip() for el in root.findall(".//sm:url/sm:loc", NS) if el.text]
    return [l for l in locs if l.startswith(keep_prefix)]
