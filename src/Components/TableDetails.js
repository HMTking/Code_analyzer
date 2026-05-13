import React, { useState } from 'react'
import { styled } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell, { tableCellClasses } from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

function TableDetails({ extractedtables }) {

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

  // const [extractedtables, setExtractedtables] = useState([
  //   {
  //     "tablename": "ReportingPartnerOne",
  //     "actualname": "ReportingPartnerOne",
  //     "createdname": "GPSStaging_CPA.ReportingPartnerOneCACR",
  //     "extractionSource": "parquet",
  //     "extractiondetails": "/mnt/processed/CPA_PM"
  //   },
  //   {
  //     "tablename": "DimPartnerProfile",
  //     "actualname": "DimPartnerProfile",
  //     "createdname": "GPSStaging_CPA.DimPartnerProfileCACR",
  //     "extractionSource": "parquet",
  //     "extractiondetails": "/mnt/processed/CPA_Partner"
  //   },
  //   {
  //     "tablename": "FactProgramScores",
  //     "actualname": "FactProgramScores",
  //     "createdname": "GPSStaging_CPA.FactProgramScoresCACR",
  //     "extractionSource": "SQL Server",
  //     "extractiondetails": "Query from [partner].[vw_PCS_FactProgramScores] table in GPSMart_Publish database"
  //   },
  //   {
  //     "tablename": "FactPartnerSpecialization",
  //     "actualname": "FactPartnerSpecialization",
  //     "createdname": "GPSStaging_CPA.FactPartnerSpecializationCACR",
  //     "extractionSource": "SQL Server",
  //     "extractiondetails": "Query from [partner].[vw_Fact_PartnerSpecialization] table in GPSMart_Publish database"
  //   },
  //   {
  //     "tablename": "FactPartnerContact",
  //     "actualname": "FactPartner_Contact",
  //     "createdname": "GPSStaging_CPA.FactPartnerContactCACR",
  //     "extractionSource": "parquet",
  //     "extractiondetails": "/mnt/processed/CPA_Partner"
  //   },
  //   {
  //     "tablename": "DimAccount",
  //     "actualname": "DimAccount",
  //     "createdname": "GPSStaging_CPA.Tmp_DimAccountCACR",
  //     "extractionSource": "parquet",
  //     "extractiondetails": "/mnt/processed/CPA_Partner"
  //   },
  //   {
  //     "tablename": "DimAccount",
  //     "actualname": "DimAccount",
  //     "createdname": "GPSStaging_CPA.DimAccountCACR",
  //     "extractionSource": "other",
  //     "extractiondetails": "created from Tmp_DimAccountCACR"
  //   },
  //   {
  //     "tablename": "Partner_Segment",
  //     "actualname": "Partner_Segment",
  //     "createdname": "GPSStaging_CPA.Partner_Segment",
  //     "extractionSource": "parquet",
  //     "extractiondetails": "/mnt/staging/stg_CPA_Digital"
  //   },
  //   {
  //     "tablename": "DimPartner",
  //     "actualname": "DimPartner",
  //     "createdname": "GPSStaging_CPA.DimPartner",
  //     "extractionSource": "parquet",
  //     "extractiondetails": "/mnt/processed/CPA_Digital"
  //   },
  //   {
  //     "tablename": "Partner_Attributes",
  //     "actualname": "Partner_Attributes",
  //     "createdname": "GPSStaging_CPA.Partner_Attributes",
  //     "extractionSource": "parquet",
  //     "extractiondetails": "/mnt/processed/CPA_BPGI"
  //   }
  // ]);

  return (
    <div>

      {
        extractedtables.length === 0 ?

          <>
            <p style={{ width: "100%", textAlign: "center", fontSize: "20px" }}>No Staging tables are extracted in the files.</p>
          </>

          :

          <>
            <TableContainer>
              <Table sx={{ minWidth: 700, border: "none" }} aria-label="customized table">
                <TableHead>
                  <TableRow>
                    <StyledTableCell >Table Name</StyledTableCell>
                    <StyledTableCell>Actual Name</StyledTableCell>
                    <StyledTableCell>Created Name</StyledTableCell>
                    <StyledTableCell>Extraction Source</StyledTableCell>
                    <StyledTableCell>Extraction Details</StyledTableCell>
                  </TableRow>
                </TableHead>
                <TableBody >
                  {extractedtables.map((row) => (
                    <StyledTableRow key={row.name}>
                      <StyledTableCell component="th" scope="row">
                        {row.tablename}
                      </StyledTableCell>
                      <StyledTableCell align="right" >{row.actualname}</StyledTableCell>
                      <StyledTableCell align="right">{row.createdname}</StyledTableCell>
                      <StyledTableCell align="right">{row.extractionSource}</StyledTableCell>
                      <StyledTableCell align="right">{row.extractiondetails}</StyledTableCell>
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

export default TableDetails
