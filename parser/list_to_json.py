import datetime
import json
import re
import googlemaps
from env import GOOGLE_API_KEY

replacements = {
    "S.F.": "San Francisco",
    "Oakand": "Oakland",
    "Oaland": "Oakland",
    "Daily City": "Daly City",
    "Memlo Park": "Menlo Park",
}
list_date_regex = r"(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s+20\d{2}"
date_regex = r"^((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2})\s+(?:mon|tue|wed|thr|fri|sat|sun)\s+"
gmaps = googlemaps.Client(key=GOOGLE_API_KEY)

def split_on_newline_and_trim(string: str) -> list:
    split = string.split("\n")
    split = list(map(str.strip, split))
    return split

def parse_show_date(raw_show_date: str, list_created_date: datetime.date) -> datetime.date:
    show_date = re.sub(r"\s+", " ", raw_show_date)
    day_number = re.search(r"\d{1,2}", show_date).group()
    if len(day_number) == 1:
        show_date = show_date.replace(day_number, f"0{day_number}")
    show_date = show_date.capitalize()
    show_date = datetime.datetime.strptime(show_date, "%b %d").date()
    show_date = show_date.replace(year=list_created_date.year)
    if show_date < list_created_date:
        show_date = show_date.replace(year=list_created_date.year + 1)
    return show_date

def parse_show_location(show_lines: list[str], details):
    location_line = None
    for line in show_lines[1:]: # first line will not have "at "
        if line.startswith("at "):
            location_line = line[3:].strip()
    if not location_line:
        for line in show_lines:
            at_idx = line.find(" at ")
            if at_idx != -1:
                location_line = line[at_idx + 4:].strip()
                break
    if not location_line:
        location_line = show_lines[0]

    if details["raw"] and details["raw"] in location_line:
        location_line = location_line[:location_line.find(details["raw"])]

    location_line = location_line.strip()
    known_cities = get_known_cities()
    for known_city in known_cities:
        if location_line.endswith(known_city):
            return location_line

    for known_city in known_cities:
        if known_city in location_line:
            return location_line[:location_line.index(known_city) + len(known_city)]

    if "a/a" in location_line:
        return location_line[:location_line.index("a/a")]

    match = re.search(r"\s\d{1,2}\+", location_line)
    if match:
        return location_line[:match.start()]

    return None

def parse_bands(show_lines: list[str]) -> list:
    print()

def parse_show_details(show_lines: list[str], location: str = None) -> dict:
    joined = " ".join(show_lines)
    details = None
    if location and location in joined:
        details = joined[joined.find(location) + len(location):]

    if not details and "a/a" in joined:
        details = joined[joined.index("a/a"):]

    match = re.search(r"\s\d{1,2}\+", joined)
    if match:
        details = joined[match.start():]

    return {
        "raw": details.strip() if details else None
    }

def get_lat_lng_from_google_result(google_result):
    return [
        google_result[0]["geometry"]["location"]["lat"],
        google_result[0]["geometry"]["location"]["lng"],
    ]

def get_show_coords(show_location):
    if not show_location:
        return [None, None]
    geocode_cache = get_geocode_cache()
    if show_location in geocode_cache:
        return get_lat_lng_from_google_result(geocode_cache[show_location])
    geocode_result = gmaps.geocode(show_location)
    if geocode_result:
        geocode_cache[show_location] = geocode_result
        write_geocode_cache(geocode_cache)
        return get_lat_lng_from_google_result(geocode_result)
    return [None, None]


id = 0
def parse_show(show_lines: list[str], list_created_date: datetime.date) -> dict:
    global id
    first_line = show_lines[0]
    date_match = re.match(date_regex, first_line, re.IGNORECASE)
    show_date = parse_show_date(date_match.group(1), list_created_date)
    raw_show_date = date_match.group()
    show_lines[0] = first_line.replace(raw_show_date, "")
    show_details = parse_show_details(show_lines)
    show_location = parse_show_location(show_lines, show_details)
    [lat, lng] = get_show_coords(show_location)

    if show_location and not show_details["raw"]:
        show_details = parse_show_details(show_lines, show_location)
    show_line = " ".join(show_lines)
    if show_details["raw"]:
        show_line = show_line.replace(show_details["raw"], "")
    if show_location:
        show_line = show_line.replace(" at " + show_location, "") # location may or may not be prefixed by " at "
        show_line = show_line.replace(show_location, "")
    show_line = re.sub(r"\s+", " ", show_line)
    show_line = show_line.strip()
    if show_line.endswith(","):
        show_line = show_line[:len(show_line) - 1]
    bands = re.split(r",\s+", show_line)
    id = id + 1
    return {
        "id": id,
        "date": show_date.strftime("%Y-%m-%d"),
        "location": show_location,
        "bands": bands,
        "lat": lat,
        "lng": lng,
        "details": show_details
    }

def split_shows(shows_block: str) -> list:
    shows = re.split(r"\n(?=[a-z])", shows_block)
    shows = list(map(split_on_newline_and_trim, shows))
    return shows

def get_shows_block(content: str) -> str:
    current_year = str(datetime.datetime.now().year)
    index = content.find(current_year)
    if index != -1:
        content = content[index + len(current_year):]
    marker = "*    All bands deserve 3 stars" # brutal delimiter
    marker_index = content.find(marker)
    if marker_index != -1:
        content = content[:marker_index]
    content = content.strip()
    return content

def parse_shows(content, list_created_date):
    shows_block = get_shows_block(content)
    split = split_shows(shows_block)
    return list(map(lambda show: parse_show(show, list_created_date), split))

def parse_list_created_date(content: str) -> datetime.date:
    match = re.search(list_date_regex, content, re.IGNORECASE)
    if match:
        return datetime.datetime.strptime(match.group(), "%B %d, %Y").date()
    return None

known_cities = None
def get_known_cities():
    global known_cities
    if known_cities is not None:
        return known_cities
    with open("./known_cities.json") as file:
        content = file.read()
        known_cities = json.loads(content)
        return known_cities

geocode_cache = None
def get_geocode_cache():
    global geocode_cache
    if geocode_cache is not None:
        return geocode_cache
    with open("./geocode_cache.json") as file:
        content = file.read()
        geocode_cache = json.loads(content)
        return geocode_cache

def write_geocode_cache(new_geocode_cache):
    global geocode_cache
    geocode_cache = new_geocode_cache
    with open("./geocode_cache.json", "w") as file:
        json.dump(new_geocode_cache, file, indent=4)

def parse_list():
    with open('./list.txt', 'r') as file:
        content = file.read()
        for key, replacement in replacements.items():
            content = content.replace(key, replacement)
        list_created_date = parse_list_created_date(content)
        shows = parse_shows(content, list_created_date)
        return {
            "created_date": list_created_date.strftime("%Y-%m-%d") if list_created_date else None,
            "shows": shows
        }

print(json.dumps(parse_list(), indent=4))
