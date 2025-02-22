import datetime
import json
import re

replacements = {
    "S.F.": "San Francisco",
    "Benders, 806 South Van Ness at 19th": "Benders, 806 South Van Ness",
}

def parse_show_line(show_line):
    month = ""
    date = 0
    day = ""
    match = re.match(r'^([a-zA-Z]+)\s+(\d{1,2})\s+([a-zA-Z]+)\s+(.*)', show_line)
    if match:
        month = match.group(1)
        date = match.group(2)
        day = match.group(3)
        show_line = match.group(4).strip()

def split_shows(show_txt):
    shows = []
    show_lines = show_txt.split('\n')
    show = ""
    for show_line in show_lines:
        if not show:
            show = show_line
        elif show_line.startswith(" "):
            show += " " + show_line.strip()
        else:
            shows.append(show)
            show = show_line
    if show:
        shows.append(show)

    return shows

def get_shows_from_the_list():
    with open('./list.txt', 'r') as file:
        content = file.read()
        current_year = str(datetime.datetime.now().year)
        index = content.find(current_year)
        if index != -1:
            content = content[index + len(current_year):]
        marker = "*    All bands deserve 3 stars"
        marker_index = content.find(marker)
        if marker_index != -1:
            content = content[:marker_index]
        content = content.strip()

        return content


show_text_block = get_shows_from_the_list()
unified_show_list = split_shows(show_text_block)
print(json.dumps(unified_show_list, indent=4))
