#!/usr/bin/env python3
import os
import re
import sys

# Check if the correct number of command-line arguments is provided
if len(sys.argv) != 2:
    print("Usage: python script.py <folder_path>")
    sys.exit(1)

folder_path = sys.argv[1]

# Task 1: Rename the file
def move_file(old_file_path, new_file_path):
    try:
        os.rename(old_file_path, new_file_path)
        print(f"File renamed: {old_file_path} -> {new_file_path}")
    except FileNotFoundError:
        print(f"File not found: {old_file_path}")
move_file(os.path.join(folder_path, "assets/js/smart-forms.min.js"), os.path.join(folder_path, "assets/js/smart-forms.mjs"))
move_file(os.path.join(folder_path, "assets/js/bs-init.js"), os.path.join(folder_path, "assets/js/bs-init.mjs"))
move_file(os.path.join(folder_path, "assets/js/startup-modern.js"), os.path.join(folder_path, "assets/js/startup-modern.mjs"))
move_file(os.path.join(folder_path, "sitemap.xml"), os.path.join(folder_path, "public/sitemap.xml"))

# Task 2: Replace script tag in HTML files
html_files = []
excluded_dirs = ["node_modules", "dist"]

# Function to recursively find HTML files
def find_html_files(directory):
    for root, dirs, files in os.walk(directory):
        if any(excluded_dir in root for excluded_dir in excluded_dirs):
            continue
        for file in files:
            if file.endswith(".html"):
                html_files.append(os.path.join(root, file))

# Find HTML files in the specified directory and its subdirectories
find_html_files(folder_path)

def replace(file, pattern, replacement):
    try:
        with open(file, "r") as f:
            content = f.read()
        content, replacements = re.subn(pattern, replacement, content)
        if replacements > 0:
            print(f"Script tag replaced in: {file}")
        with open(file, "w") as f:
            f.write(content)
    except FileNotFoundError:
        print(f"File not found: {file}")
    return content, replacements

# Replace script tag in HTML files
for html_file in html_files:
    replace(html_file,
            r'<script\s+src="(.*)?smart-forms\.min\.js">',
            r'<script src="\1smart-forms.mjs" type="module">')

    replace(html_file,
            r'<script\s+src="(.*)?bs-init\.js">',
            r'<script src="\1bs-init.mjs" type="module">')
    
    replace(html_file,
            r'<script\s+src="(.*)?startup-modern\.js">',
            r'<script src="\1startup-modern.mjs" type="module">')
    
    # Remove .html extension from links
    replace(html_file,
            r'<a\s+([^>]*\s+)?href="([^"]+)\.html"([^>]*)?>',
            r'<a \1href="\2"\3>')
    
    # Replace /index.html with /
    replace(html_file,
            r'<a\s+([^>]*\s+)?href="\/index"([^>]*)?>',
            r'<a \1href="/"\2>')

print("Script execution completed.")