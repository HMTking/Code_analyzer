import React, { useState } from 'react'
import { styled } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell, { tableCellClasses } from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

function MountsTable({ mounts }) {

  const StyledTableCell = styled(TableCell)(({ theme }) => ({
    [`&.${tableCellClasses.head}`]: {
      backgroundColor: theme.palette.common.black,
      color: theme.palette.common.white,
    },
    [`&.${tableCellClasses.body}`]: {
      fontSize: 14,
    },
  }));

  const StyledTableRow = styled(TableRow)(({ theme }) => ({
    '&:nth-of-type(odd)': {
      backgroundColor: theme.palette.action.hover,
    },
    // hide last border
    '&:last-child td, &:last-child th': {
      border: 0,
    },
  }));

  // const [mounts, setMounts] = useState([
  //     {
  //         "DummyPath": "/mnt/processed/CPA_Digital",
  //         "ActualPath": "abfss://processed@[ADLS Name Placeholder]/Digital"
  //     },
  //     {
  //         "DummyPath": "/mnt/processed/CPA_PM",
  //         "ActualPath": "abfss://processed@[ADLS Name Placeholder]/partnermastering"
  //     },
  //     {
  //         "DummyPath": "/mnt/processed/CPA_Partner",
  //         "ActualPath": "abfss://processed@[ADLS Name Placeholder]/PartnerV1"
  //     },
  //     {
  //         "DummyPath": "/mnt/processed/CPA_BPGI",
  //         "ActualPath": "abfss://processed@[ADLS Name Placeholder]/BPGI"
  //     },
  //     {
  //         "DummyPath": "/mnt/cpa/Input_Excels/",
  //         "ActualPath": "wasbs://cpa@[Storage Account Name Placeholder]/Input_Excels/"
  //     }
  // ]);

  return (
    <div>
      {
        mounts.length === 0 ?
          <><p style={{ width: "100%", textAlign: "center", fontSize: "20px" }}>No Mounts are created in the files.</p></>
          :
          <>
            <TableContainer>
              <Table sx={{ minWidth: 700 }} aria-label="customized table">
                <TableHead>
                  <TableRow>
                    <StyledTableCell>Dummy Path</StyledTableCell>
                    <StyledTableCell>Actual Path</StyledTableCell>
                  </TableRow>
                </TableHead>
                <TableBody >
                  {mounts.map((row) => (
                    <StyledTableRow key={row.DummyPath}>
                      <StyledTableCell component="th" scope="row">
                        {row.DummyPath}
                      </StyledTableCell>
                      <StyledTableCell align="right">{row.ActualPath}</StyledTableCell>
                    </StyledTableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
      }
    </div>
  )
}

export default MountsTable
