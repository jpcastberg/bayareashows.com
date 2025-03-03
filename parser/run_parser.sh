#! /usr/bin/env bash
current_date_time=$(date +"%Y%m%d_%H%M%S")
list_file_path="/tmp/list.txt"

response=$(curl -s -o $list_file_path -w "%{http_code}" https://www.stevelist.com/list)

if [ "$response" -eq 200 ]; then
    echo "Successfully fetched the contents and saved to $list_file_path"
    # Proceed with further processing
else
    echo "Failed to fetch the contents. HTTP status code: $response"
    exit 1
fi

script_dir=$(dirname "$(readlink -f "$0")")
python3 "$script_dir/list_to_json.py" "$list_file_path"
