#!/bin/bash
# Script para corrigir terminações de linha dos scripts

cd "$(dirname "$0")"

# Converter todos os .sh para formato Unix
for file in *.sh; do
    if [ -f "$file" ]; then
        sed -i 's/\r$//' "$file"
        echo "Corrigido: $file"
    fi
done

echo "Todos os scripts foram convertidos para formato Unix!"
