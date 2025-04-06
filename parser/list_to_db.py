import datetime
import json
import re
import os
import requests
import urllib.parse
import sys
from google.maps import places_v1
import mysql.connector
from mysql.connector import Error as MysqlError

try:
    from env import GOOGLE_API_KEY, MYSQL_DATABASE, MYSQL_HOST_DEV, MYSQL_HOST_PROD, MYSQL_USER, MYSQL_PASSWORD
except ImportError:
    GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
    MYSQL_HOST_DEV = os.getenv('MYSQL_HOST_DEV')
    MYSQL_HOST_PROD = os.getenv('MYSQL_HOST_PROD')
    MYSQL_DATABASE = os.getenv('MYSQL_DATABASE')
    MYSQL_USER = os.getenv('MYSQL_USER')
    MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD')

if len(sys.argv) < 2:
    print("Usage: python list_to_json.py <list_path>")
    sys.exit(1)

list_path = sys.argv[1]
replacements = {
    "S.F.": "San Francisco",
    "Oakand": "Oakland",
    "Oaland": "Oakland",
    "Daily City": "Daly City",
    "Memlo Park": "Menlo Park",
    "Ugra Deva Loka, ": "", # wtf
    " & ": " and ", # of course there's a band called Amprs&nd
}
list_date_regex = r"(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s+20\d{2}"
date_regex = r"^((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2})\s+(?:mon|tue|wed|thr|fri|sat|sun)\s+"
current_dir = os.path.dirname(os.path.realpath(__file__))
def get_db():
    mysql_host = MYSQL_HOST_PROD if os.environ.get("ENV") == "PROD" else MYSQL_HOST_DEV
    try:
        connection = mysql.connector.connect(
            host=mysql_host,
            database=MYSQL_DATABASE,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD
        )
        if connection.is_connected():
            return connection
    except MysqlError as e:
        log(f"Error while connecting to MySQL: {e}")
        return None

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
    location = None
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
            location = location_line

    if not location:
        for known_city in known_cities:
            if known_city in location_line:
                location = location_line[:location_line.index(known_city) + len(known_city)]

    if not location and "a/a" in location_line:
        location = location_line[:location_line.index("a/a")]

    if not location:
        match = re.search(r"\s\d{1,2}\+", location_line)
        if match:
            location = location_line[:match.start()]

    return location.strip() if location else None

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

    start_time = None
    end_time = None
    time_match = re.search(
        r"((?:[012]{2}|[1-9])(?:\:[0-5][0-9])?(?:am|pm))(?:(?:/| til )((?:[012]{2}|[1-9])(?:\:[0-5][0-9])?(?:am|pm)))?",
        joined,
        re.IGNORECASE
    )
    if time_match:
        start_time = convert_time_string(time_match.group(1))
        if time_match.group(2):
            end_time = convert_time_string(time_match.group(2))

    cost = None
    cost_match = re.search(
        r"((?:\$\d(?:.+\(.*(?:\$[^)]+|\bfree\b[^)]*)\)|[^\s]+)?)|\bfree\b)",
        joined,
        re.IGNORECASE
    )
    if cost_match:
        cost = cost_match.group(1)

    age_limit = None
    age_limit_match = re.search(
        r"((?<!\$)(?:\d+\+(?:.+ with adult\))?)|\ba/a\b)",
        joined,
        re.IGNORECASE
    )
    if age_limit_match:
        age_limit = age_limit_match.group()

    sell_out_likely = True if re.search(r" \$( |$)", joined) else None
    under_21_pays_more = True if re.search(r" \^( |$)", joined) else None
    mosh_pit = True if re.search(r" @( |$)", joined) else None
    no_ins_outs = True if re.search(r" #( |$)", joined) else None
    sold_out = True if re.search(r"\(sold out\)", joined) else None

    show_details = {
        "raw": details.strip() if details else None,
        "start_time": start_time,
        "end_time": end_time,
        "cost": cost,
        "age_limit": age_limit,
        "sell_out_likely": sell_out_likely,
        "under_21_pays_more": under_21_pays_more,
        "mosh_pit": mosh_pit,
        "no_ins_outs": no_ins_outs,
        "sold_out": sold_out,
    }

    return show_details

def convert_time_string(time_string):
    return datetime.datetime.strptime(
        time_string,
        "%I:%M%p" if ":" in time_string else "%I%p"
    ).time().strftime("%H:%M:%S")

venue_img_dir = f"{current_dir}/../public/images/venues"
client = places_v1.PlacesClient()
def save_image(url, filename):
    response = requests.get(url)
    if not response.ok:
        return None
    file_path = os.path.join(venue_img_dir, filename)
    with open(file_path, 'wb') as file:
        file.write(response.content)
    return f"/images/venues/{filename}"

def fetch_google_place_id(location):
    request = places_v1.SearchTextRequest(
        text_query=location,
    )

    fieldMask = "places.id"
    response = client.search_text(request=request, metadata=[("x-goog-fieldmask", fieldMask)])
    if not response:
        log(f"No response for location {location}!")
        return None

    if len(response.places) == 0:
        log(f"Empty response for location {location}! Response: {response}")
        return None
    return response.places[0].id

def fetch_and_cache_venue_data(location):
    place_id = fetch_google_place_id(location)
    if not place_id:
        log(f"Place ID for {location} not found")
        return None

    log(f"Saving place id {place_id} for location {location}")
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id FROM venues WHERE google_place_id = %s", [place_id])
    result = cursor.fetchone()
    if result:
        venue_id = result["id"]
        cursor.execute("""INSERT INTO locations_venues (location, venue_id)
            VALUES (%s, %s)""", [location, venue_id])
        return

    log(f"Fetching place information for location {location}, place id {place_id}")
    request = places_v1.GetPlaceRequest(
        name=f"places/{place_id}"
    )

    fieldMask = "displayName,shortFormattedAddress,addressComponents,photos,location"
    response = client.get_place(request=request, metadata=[("x-goog-fieldmask", fieldMask)])
    if not response:
        log(f"No response for place id location {location}, place id {place_id}")
        return None
    venue_data = {}
    venue_data["google_place_id"] = place_id
    venue_data["name"] = response.display_name.text
    venue_data["address"] = response.short_formatted_address
    venue_data["lat"] = response.location.latitude
    venue_data["lng"] = response.location.longitude
    venue_data["city"] = None
    venue_data["photo"] = None

    known_cities = get_known_cities()
    for component in response.address_components:
        if "locality" in component.types:
            venue_data["city"] = component.long_text
            if component.long_text not in known_cities:
                save_city(component.long_text)

    # Clean the filename
    filename = f"{venue_data['name']} {venue_data['address']}"
    filename = re.sub(r'[^a-zA-Z0-9 ]', '', filename)
    filename = f"{filename.replace(' ', '_')}.jpg"

    # Check if a file with the same name already exists
    image_exists = os.path.exists(f"{venue_img_dir}/{filename}")

    if image_exists:
        venue_data["photo"] = f"/images/venues/{filename}"

    elif response and len(response.photos) > 0:
        log(f"Grabbing nice photo for {location}")
        request = places_v1.GetPhotoMediaRequest(
            name=f"{response.photos[0].name}/media",
            max_width_px=300,
            max_height_px=300
        )
        response = client.get_photo_media(request)
        venue_data["photo"] = save_image(response.photo_uri, filename)

    else:
        log(f"Grabbing street view photo for {location}")
        encoded_location = urllib.parse.quote_plus(venue_data["address"])
        streetview_url = f"https://maps.googleapis.com/maps/api/streetview?location={encoded_location}&size=300x300&key={GOOGLE_API_KEY}"
        venue_data["photo"] = save_image(streetview_url, filename)

    db = get_db()
    cursor = db.cursor()
    log(f"Saving venue data: {venue_data}")
    cursor.execute("""INSERT INTO venues
        (google_place_id, name, address, city, lat, lng, photo)
        VALUES
        (%(google_place_id)s, %(name)s, %(address)s, %(city)s, %(lat)s, %(lng)s, %(photo)s)""", venue_data)
    venue_id = cursor.lastrowid
    cursor.execute("""INSERT INTO locations_venues (location, venue_id)
        VALUES (%s, %s)""", [location, venue_id])
    db.commit()



def parse_and_save_show(show: str, list_created_date: datetime.date) -> dict:
    show_lines = show.split("\n")
    first_line = show_lines[0]
    date_match = re.match(date_regex, first_line, re.IGNORECASE)
    show_date = parse_show_date(date_match.group(1), list_created_date)
    raw_show_date = date_match.group()
    show_lines[0] = first_line.replace(raw_show_date, "")
    show_details = parse_show_details(show_lines)
    show_location = parse_show_location(show_lines, show_details)
    venue = get_show_venue(show_location)

    if not venue:
        log(f"Could not parse venue from {show_location}")
        return

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
    bands = list(map(str.strip, bands))
    parsed_show = {
        "date": show_date.strftime("%Y-%m-%d"),
        "venue_id": venue[0],
        "raw": show,
        "start_time": show_details["start_time"],
        "end_time": show_details["end_time"],
        "cost": show_details["cost"],
        "age_limit": show_details["age_limit"],
        "sell_out_likely": show_details["sell_out_likely"],
        "under_21_pays_more": show_details["under_21_pays_more"],
        "mosh_pit": show_details["mosh_pit"],
        "no_ins_outs": show_details["no_ins_outs"],
        "sold_out": show_details["sold_out"],
    }

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("""INSERT INTO shows
        (date, venue_id, raw, start_time,
        end_time, cost, age_limit, sell_out_likely, under_21_pays_more,
        mosh_pit, no_ins_outs, sold_out)
        VALUES
        (%(date)s, %(venue_id)s, %(raw)s, %(start_time)s,
        %(end_time)s, %(cost)s, %(age_limit)s, %(sell_out_likely)s, %(under_21_pays_more)s,
        %(mosh_pit)s, %(no_ins_outs)s, %(sold_out)s)""", parsed_show)
    show_id = cursor.lastrowid

    for band in bands:
        band.replace("&", "And")
        cursor.execute("SELECT id FROM bands WHERE name = %s", [band])
        result = cursor.fetchone()
        if result:
            band_id = result["id"]
        else:
            log(f"Adding new band to the roster: {band}")
            cursor.execute("INSERT INTO bands (name) VALUES (%s)", [band])
            band_id = cursor.lastrowid
        cursor.execute("""INSERT INTO bands_shows (band_id, show_id)
            VALUES (%s, %s)""", [band_id, show_id])
    db.commit()

def split_shows(shows_block: str) -> list[str]:
    shows = re.split(r"\n(?=[a-z])", shows_block)
    shows = list(map(split_on_newline_and_trim, shows))
    shows = list(map(lambda show: "\n".join(show), shows))
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

show_cache = set()
def parse_and_save_shows(content, list_created_date):
    shows_block = get_shows_block(content)
    shows = split_shows(shows_block)
    db = get_db()
    cursor = db.cursor(dictionary=True)
    for show in shows:
        show_cache.add(show)
        cursor.execute(
            "SELECT id, deleted FROM shows WHERE date >= CURDATE() AND raw = %s", [show]
        )
        result = cursor.fetchone()
        if result:
            if result["deleted"]:
                undelete_show(result["id"])
            continue
        log(f"Found new show: {show}, parsing!")
        try:
            parse_and_save_show(show, list_created_date)
        except Exception as err:
            print(f"Exception while parsing show: '{show}' '{err}'")

def undelete_show(id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute("UPDATE shows SET deleted = 0 WHERE id = %s", [id])
    cursor.execute("UPDATE bands_shows SET deleted = 0 WHERE id = %s", [id])
    db.commit()
    print()

def parse_list_created_date(content: str) -> datetime.date:
    match = re.search(list_date_regex, content, re.IGNORECASE)
    if match:
        return datetime.datetime.strptime(match.group(), "%B %d, %Y").date()
    return None

def get_show_venue(location: str):
    if not location:
        log(f"(get_show_venue) no location, returning")
        return None
    location = location.strip()
    cached_venue = get_venue_from_cache(location)
    if cached_venue:
        return cached_venue

    fetch_and_cache_venue_data(location)
    return get_venue_from_cache(location)

def get_venue_from_cache(location: str):
    if not location:
        log(f"(get_venue_from_cache) no location, returning")
        return None
    location = location.strip()
    log(f"Attempting to grab cached info for {location}")
    db = get_db()
    cursor = db.cursor()
    cursor.execute("""SELECT venues.* FROM locations_venues
        JOIN venues ON locations_venues.venue_id = venues.id
        WHERE location = %s""", [location])
    result = cursor.fetchone()
    if result:
        log(f"Cached result found for {location}")
    else:
        log(f"No cached result found for {location}")
    return result

known_cities_cache = None
def get_known_cities():
    global known_cities_cache
    if known_cities_cache:
        return known_cities_cache

    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT name FROM cities")
    cities = []
    result = cursor.fetchall()
    for entry in result:
        cities.append(entry[0])
    known_cities_cache = cities
    return cities

def save_city(city):
    db = get_db()
    cursor = db.cursor()
    cursor.execute("INSERT INTO cities (name) VALUES (%s)", [city])
    db.commit()

def write_venue_cache(new_venue_cache):
    global venue_cache
    venue_cache = new_venue_cache
    with open(f"{current_dir}/venue_cache.json", "w") as file:
        json.dump(new_venue_cache, file, indent=4)

def remove_stale_shows():
    db = get_db()

def parse_and_save_list():
    with open(list_path, 'r') as file:
        content = file.read()
        for key, replacement in replacements.items():
            content = content.replace(key, replacement)
        list_created_date = parse_list_created_date(content)
        parse_and_save_shows(content, list_created_date)

def remove_stale_shows():
    global show_cache
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, raw FROM shows WHERE date >= CURDATE() AND deleted = 0")
    result = cursor.fetchall()
    for entry in result:
        if not entry["raw"] in show_cache:
            log(f"Show {entry['raw']} not in show_cache, deleting show id {entry['id']}")
            cursor.execute("UPDATE bands_shows SET deleted = 1 WHERE show_id = %s", [entry["id"]])
            cursor.execute("UPDATE shows SET deleted = 1 WHERE id = %s", [entry["id"]])
    db.commit()

def log(message: str):
    current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{current_time}] {message}")

parse_and_save_list()
remove_stale_shows()
