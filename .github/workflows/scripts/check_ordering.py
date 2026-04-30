#!/usr/bin/env python3
"""
Check if collection.json is ordered alphabetically by the 'name' field.
"""
import json
import sys

def check_ordering(json_file):
    """
    Check if entries are ordered alphabetically by name field.
    
    Uses case-insensitive comparison to ensure consistent ordering
    regardless of capitalization (e.g., 'Abc' comes before 'xyz').
    """
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not isinstance(data, list):
            print("ERROR: JSON root must be an array")
            return False
        
        # Check for missing names and collect names
        names = []
        for i, entry in enumerate(data):
            if 'name' not in entry:
                print(f"ERROR: Entry at index {i} is missing required 'name' field")
                return False
            names.append(entry['name'])
        
        # Adjacent-pair check (case-insensitive). Comparing the full list to
        # sorted(names) misreports every index after the first mistake because
        # positions no longer align with a global sort.
        errors = False
        for i in range(len(names) - 1):
            current, nxt = names[i], names[i + 1]
            if current.lower() > nxt.lower():
                print(
                    "ERROR: Out of order at indices "
                    f"{i}-{i + 1}: '{current}' then '{nxt}' "
                    "(case-insensitive name order requires "
                    f"'{nxt}' before '{current}')"
                )
                errors = True
        
        if errors:
            return False
        
        print("SUCCESS: All entries are ordered alphabetically by 'name' field")
        return True
    
    except FileNotFoundError:
        print(f"ERROR: File '{json_file}' not found")
        return False
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON - {e}")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: check_ordering.py <json_file>")
        sys.exit(1)
    
    success = check_ordering(sys.argv[1])
    sys.exit(0 if success else 1)
