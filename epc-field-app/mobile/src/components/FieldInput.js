import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

function Chip({ label, selected, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function TableInput({ field, value, onChange }) {
  const rows = field.optionsJson?.rows || [];
  const columns = field.optionsJson?.columns || [{ key: 'value', label: 'Value' }];
  const rowValue = value || {};

  function setCell(rowLabel, colKey, text) {
    onChange({
      ...rowValue,
      [rowLabel]: { ...(rowValue[rowLabel] || {}), [colKey]: text },
    });
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
      {rows.map((rowLabel) => (
        <View key={rowLabel} style={styles.tableRow}>
          <Text style={styles.tableRowLabel}>{rowLabel}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {columns.map((col) => (
              <View key={col.key} style={{ flex: 1, minWidth: 100 }}>
                <Text style={styles.tableColLabel}>{col.label}</Text>
                <TextInput
                  style={styles.tableInput}
                  value={rowValue[rowLabel]?.[col.key] || ''}
                  onChangeText={(text) => setCell(rowLabel, col.key, text)}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Renders one FormFieldDef as an editable RN input, mirroring the PDF/admin-web renderers. */
export default function FieldInput({ field, value, onChange }) {
  if (field.type === 'table') {
    return <TableInput field={field} value={value} onChange={onChange} />;
  }

  if (field.type === 'checkbox' || field.type === 'file') {
    return (
      <View style={[styles.field, styles.checkboxRow]}>
        <Text style={styles.checkboxLabel}>
          {field.label}{field.required ? ' *' : ''}
          {field.type === 'file' ? '\n(confirm document collected/attached)' : ''}
        </Text>
        <Switch value={!!value} onValueChange={onChange} />
      </View>
    );
  }

  if (field.type === 'select') {
    const options = field.optionsJson?.options || [];
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {options.map((opt) => (
            <Chip key={opt} label={opt} selected={value === opt} onPress={() => onChange(opt)} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
      <TextInput
        style={styles.input}
        value={value !== undefined && value !== null ? String(value) : ''}
        onChangeText={onChange}
        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
        placeholder={field.type === 'date' ? 'YYYY-MM-DD' : ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#dde2df',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: 'white',
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checkboxLabel: { fontSize: 13, fontWeight: '600', color: '#333', flex: 1, marginRight: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#dde2df',
    backgroundColor: 'white',
  },
  chipSelected: { backgroundColor: '#0b6e4f', borderColor: '#0b6e4f' },
  chipText: { fontSize: 13, color: '#333' },
  chipTextSelected: { color: 'white', fontWeight: '600' },
  tableRow: { marginBottom: 10, backgroundColor: '#f7f9f8', borderRadius: 8, padding: 10 },
  tableRowLabel: { fontSize: 12.5, fontWeight: '700', color: '#0b6e4f', marginBottom: 6 },
  tableColLabel: { fontSize: 11, color: '#777', marginBottom: 3 },
  tableInput: {
    borderWidth: 1,
    borderColor: '#dde2df',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    backgroundColor: 'white',
  },
});
