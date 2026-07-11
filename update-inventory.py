#!/usr/bin/env python3
"""
Regenerate inventory.js for the MHSRV "It's a Deal" sheet from a fresh
NetSource Media CSV export.

Usage:
    python3 update-inventory.py path/to/netsource_export.csv

Then commit & push the new inventory.js through GitHub Desktop.

Reads only: Stock Number, Year, Brand, Model, Floorplan, Condition,
Sale Price, Price, VIN, Mileage.
The dealer Cost column is NEVER read or written.
"""
import csv, json, sys, datetime

def num(v):
    v = (v or '').replace(',', '').replace('$', '').strip()
    try:
        f = float(v)
        return f if f > 0 else None
    except ValueError:
        return None

def main():
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 update-inventory.py path/to/export.csv')

    rows = list(csv.DictReader(open(sys.argv[1], newline='', encoding='utf-8', errors='replace')))
    inv = {}
    for r in rows:
        stock = r.get('Stock Number', '').strip().upper()
        if not stock:
            continue
        desc = ' '.join(x for x in [r.get('Year','').strip(), r.get('Brand','').strip(),
                                    r.get('Model','').strip(), r.get('Floorplan','').strip()] if x)
        if r.get('Condition', '').strip().lower() == 'used':
            desc = 'Used ' + desc
        price = num(r.get('Sale Price')) or num(r.get('Price'))   # never Cost
        vin = r.get('VIN', '').strip().upper()
        vin8 = vin[-8:] if len(vin) >= 8 else ''
        miles = r.get('Mileage', '').strip()
        inv[stock] = [desc, int(price) if price else 0, vin8, miles]

    date = datetime.date.today().strftime('%B %-d, %Y')
    with open('inventory.js', 'w') as f:
        f.write('/* MHSRV inventory lookup for the deal sheet.\n')
        f.write('   Generated from the NetSource Media export on %s — %d units.\n' % (date, len(inv)))
        f.write('   To refresh: run update-inventory.py against a new CSV export (see README).\n')
        f.write('   Each entry: stock -> [description, sale price, last 8 of VIN, mileage] */\n')
        f.write("const MHS_INVENTORY_DATE = '%s';\n" % date)
        f.write('const MHS_INVENTORY = {\n')
        for k, v in sorted(inv.items()):
            f.write(json.dumps(k) + ':' + json.dumps(v, ensure_ascii=False) + ',\n')
        f.write('};\n')

    print('Wrote inventory.js — %d units, dated %s' % (len(inv), date))

if __name__ == '__main__':
    main()
