import os
import json
import time
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
import re
from flask import Flask, jsonify, render_template, request
from bs4 import BeautifulSoup

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = "notes_cache.json"
CACHE_DURATION_SECS = 3600  # 1 hour cache duration

# In-memory cache fallback
_mem_cache = None
_last_fetch_time = 0

def clean_excessive_newlines(text):
    return re.sub(r'\n{3,}', '\n\n', text)

def parse_release_content(content_html):
    """
    Parses the CDATA HTML content of an Atom entry into separate release items.
    Groups elements under <h3> titles (Feature, Issue, Deprecation, etc.).
    Also generates clean plain text versions of each update for Tweeting.
    """
    if not content_html:
        return []
    
    soup = BeautifulSoup(content_html, 'html.parser')
    items = []
    
    current_type = "Update"
    current_html_parts = []
    current_text_parts = []
    
    def get_element_text(element):
        if not element:
            return ""
        if isinstance(element, str):
            return element
        
        # Format links to 'text (url)'
        if element.name == 'a':
            href = element.get('href', '').strip()
            text = element.get_text().strip()
            if href:
                if href.startswith('/'):
                    href = 'https://cloud.google.com' + href
                if href != text and text:
                    return f"{text} ({href})"
                else:
                    return href
            return text
        
        # Format bullet list items
        if element.name == 'li':
            parts = []
            for c in element.children:
                parts.append(get_element_text(c))
            return "• " + "".join(parts).strip() + "\n"
        
        # Recursively process other tags
        parts = []
        for c in element.children:
            if isinstance(c, str):
                parts.append(c)
            else:
                parts.append(get_element_text(c))
        
        content_str = "".join(parts)
        if element.name in ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol']:
            return content_str.strip() + "\n"
        return content_str

    for child in soup.contents:
        if isinstance(child, str):
            continue
            
        if child.name in ['h3', 'h4', 'h2']:
            if current_html_parts or current_text_parts:
                items.append({
                    'type': current_type,
                    'html': "".join(current_html_parts).strip(),
                    'text': clean_excessive_newlines("".join(current_text_parts)).strip()
                })
                current_html_parts = []
                current_text_parts = []
            current_type = child.get_text().strip()
        else:
            current_html_parts.append(str(child))
            current_text_parts.append(get_element_text(child))
            
    if current_html_parts or current_text_parts:
        items.append({
            'type': current_type,
            'html': "".join(current_html_parts).strip(),
            'text': clean_excessive_newlines("".join(current_text_parts)).strip()
        })
        
    return items

def fetch_feed_from_google():
    """
    Fetches the XML from Google's feed url and parses it.
    Returns a list of entries with dates and parsed sub-items.
    """
    req = urllib.request.Request(
        FEED_URL, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BigQueryReleaseExplorer/1.0'}
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        xml_data = response.read()
    
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    root = ET.fromstring(xml_data)
    
    entries = root.findall('atom:entry', ns)
    parsed_entries = []
    
    for entry in entries:
        title = entry.find('atom:title', ns)
        title_text = title.text.strip() if title is not None else "Unknown Date"
        
        updated_el = entry.find('atom:updated', ns)
        updated_text = updated_el.text.strip() if updated_el is not None else ""
        
        link_el = entry.find('atom:link[@rel="alternate"]', ns)
        alternate_url = link_el.get('href', '').strip() if link_el is not None else "https://cloud.google.com/bigquery/docs/release-notes"
        
        content_el = entry.find('atom:content', ns)
        content_html = content_el.text if content_el is not None else ""
        
        items = parse_release_content(content_html)
        
        parsed_entries.append({
            'date': title_text,
            'updated': updated_text,
            'url': alternate_url,
            'items': items
        })
        
    return parsed_entries

def get_notes(force_refresh=False):
    """
    Retrieves the notes, utilizing caching (both file and in-memory).
    """
    global _mem_cache, _last_fetch_time
    now = time.time()
    
    # Check if we should use cached notes
    if not force_refresh:
        # Check memory cache
        if _mem_cache is not None and (now - _last_fetch_time) < CACHE_DURATION_SECS:
            return _mem_cache, _last_fetch_time, "memory_cache"
        
        # Check file cache
        if os.path.exists(CACHE_FILE):
            try:
                mtime = os.path.getmtime(CACHE_FILE)
                if (now - mtime) < CACHE_DURATION_SECS:
                    with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        _mem_cache = data.get('entries', [])
                        _last_fetch_time = data.get('fetched_at', mtime)
                        return _mem_cache, _last_fetch_time, "file_cache"
            except Exception as e:
                # Log error and continue to fetch fresh
                app.logger.warning(f"Failed to read file cache: {e}")
                
    # Fetch fresh
    try:
        entries = fetch_feed_from_google()
        _mem_cache = entries
        _last_fetch_time = now
        
        # Write to file cache
        try:
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump({
                    'fetched_at': _last_fetch_time,
                    'entries': entries
                }, f, ensure_ascii=False, indent=2)
        except Exception as e:
            app.logger.warning(f"Failed to write file cache: {e}")
            
        return entries, _last_fetch_time, "network"
    except Exception as e:
        # If network fails, try to load any stale cache
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return data.get('entries', []), data.get('fetched_at', 0), "stale_cache_after_error"
            except:
                pass
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def api_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        entries, fetched_at, source = get_notes(force_refresh=force_refresh)
        return jsonify({
            'status': 'success',
            'fetched_at': fetched_at,
            'source': source,
            'entries': entries
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    # Bind to localhost
    app.run(debug=True, host='127.0.0.1', port=5000)
