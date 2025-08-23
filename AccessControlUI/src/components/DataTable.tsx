import { ReactNode } from 'react';
import { Table, Tbody, Tr, Th, Td } from './ui/table';

export interface Column<T> {
  header: string;
  accessor: (row: T) => ReactNode;
}

export function DataTable<T>({ columns, data }: { columns: Column<T>[]; data: T[] }) {
  return (
    <Table>
      <Tbody>
        <tr>
          {columns.map((col) => (
            <Th key={col.header}>{col.header}</Th>
          ))}
        </tr>
        {data.map((row, i) => (
          <Tr key={i}>
            {columns.map((col) => (
              <Td key={col.header}>{col.accessor(row)}</Td>
            ))}
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
