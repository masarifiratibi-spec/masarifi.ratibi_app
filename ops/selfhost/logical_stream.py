"""Narrow pg_dump header handling; COPY payload bytes are always passed through."""
import re


def skip_precreated_schemas(lines, schemas):
    remaining = set(schemas)
    header = None
    budget = 0
    data_started = False
    for line in lines:
        if line.startswith(b'COPY '):
            data_started = True
            header = None
        if not data_started:
            match = re.fullmatch(rb'-- Name: ([A-Za-z_][A-Za-z_0-9]*); Type: SCHEMA; Schema: -; Owner: [A-Za-z_][A-Za-z_0-9]*\r?\n', line)
            if match:
                name = match.group(1).decode('ascii')
                header = name if name in remaining else None
                budget = 8
            elif header:
                if line.rstrip(b'\r\n') == ('CREATE SCHEMA ' + header + ';').encode():
                    remaining.remove(header)
                    header = None
                    continue
                budget -= 1
                if budget <= 0:
                    header = None
        yield line
    if remaining:
        raise ValueError('SCHEMA_HEADER_DRIFT')
