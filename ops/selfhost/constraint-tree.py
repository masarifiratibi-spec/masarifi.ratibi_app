"""Canonical PostgreSQL check trees: locations, byte signedness and AND/OR grouping.

Keep every operator, type, collation, argument order and value. PostgreSQL may
flatten associative boolean nodes while parsing pg_dump's SQL, and builds differ
in their signed-char byte rendering. Neither changes a check's SQL semantics.
"""
import re


def canonical_tree(value):
    if value is None:
        return None
    tokens=re.findall(r'\{|\}|\(|\)|\[|\]|[^\s{}()\[\]]+',value)
    position=0
    pairs={'{':'}','(':')','[':']'}

    def parse():
        nonlocal position
        token=tokens[position];position+=1
        if token not in pairs:
            assert token not in pairs.values(),'Unexpected closing token'
            return token
        children=[]
        while position<len(tokens) and tokens[position]!=pairs[token]:
            children.append(parse())
        assert position<len(tokens),'Unclosed tree'
        position+=1
        if token=='[':
            assert all(isinstance(x,str) and -128<=int(x)<=255 for x in children)
            return ['bytes',*[str(int(x)%256) for x in children]]
        if token=='{':
            cleaned=[];i=0
            while i<len(children):
                if children[i]==':location':
                    assert i+1<len(children) and re.fullmatch(r'-?\d+',children[i+1])
                    i+=2
                else:
                    cleaned.append(children[i]);i+=1
            children=cleaned
            if children and children[0]=='BOOLEXPR':
                op=children[children.index(':boolop')+1]
                args_index=children.index(':args')+1
                if op in ('and','or'):
                    flattened=['(']
                    for child in children[args_index][1:]:
                        if isinstance(child,list) and child[:2]==['{','BOOLEXPR'] and child[child.index(':boolop')+1]==op:
                            flattened.extend(child[child.index(':args')+1][1:])
                        else:
                            flattened.append(child)
                    children[args_index]=flattened
        return [token,*children]

    result=parse()
    assert position==len(tokens),'Trailing tree tokens'
    return result
