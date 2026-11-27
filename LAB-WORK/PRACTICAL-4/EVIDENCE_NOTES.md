# Practical 4 Evidence Notes

## Execution

- Runtime: local Java 25 (`java version "25" 2025-09-16 LTS`, build `25+37-LTS-3491`).
- Commands used in the VS Code integrated terminal:
  ```powershell
  cd C:\Users\karka\Advanced-Object-Oriented-Programming-Project\LAB-WORK\PRACTICAL-4
  javac -encoding UTF-8 -d out src\Practical4Demo.java
  java -cp out Practical4Demo
  ```
- `javac` exited 0 with no stdout; `java` exited 0.
- Total checks run: **26**. Failures: **0**. Result: **PASS**.
- `VSCODE_OUTPUT.txt` contains the exact commands and full stdout.
- `VSCODE_EDITOR.png` and `VSCODE_TERMINAL.png` are real 1600×1000 captures of the VS Code window used for this run.

## Case studies

- **Case Study 1 - Design by Contract:** `FirstFitAllocator`, `LowestOccupancyZoneAllocator`, and `NearestEntryAllocator` met the contract. The shared suite detected violations in `SaboteurAllocator`; the corresponding PASS means detection worked as expected.
- **Case Study 2 - LSP:** `SavingsAccount`, `CurrentAccount`, and both `FixedDepositAccount` instances were substituted through `BankAccount`; the immature FD declined withdrawal instead of throwing.
- **Case Study 3 - Sealed/abstract/interface design:** all four permitted `Course` implementations registered and graded successfully, and the exhaustive pattern-matching switch produced the expected kinds.
- **Case Study 4 - Contract testing/debugging:** the three valid processors passed; the suite detected five violations in `DefectiveProcessor`, including the unexpected `IllegalStateException`, blank receipt id, and changed amount.
- **Case Study 5 - Cost of change/SOLID:** `ScanService` was registered without editing the workflow, all three services ran, and `AuditObserver` recorded all three events.

## Implementation classification

- **Valid implementations:** `FirstFitAllocator`, `LowestOccupancyZoneAllocator`, `NearestEntryAllocator`, `SavingsAccount`, `CurrentAccount`, `FixedDepositAccount`, `RegularCourse`, `LabCourse`, `ElectiveCourse`, `ResearchCourse`, `CreditCardProcessor`, `UpiProcessor`, `NetBankingProcessor`, `RegistrationService`, `DiagnosticService`, `ScanService`, `CashBilling`, `InsuranceBilling`, and `AuditObserver`.
- **Saboteur/defective examples:** `SaboteurAllocator` violates allocator preconditions/postconditions; `DefectiveProcessor` violates payment preconditions/postconditions and throws an unexpected unchecked exception.
- **Not a `Course` implementation:** `AbstractCourse` is a plain abstract base outside the sealed hierarchy; it supplies shared final method implementations only. The valid concrete `Course` implementations are the four classes named in the `permits` clause.

## Submission format

- `Practical-4.docx` and `Practical-4.pdf` follow the same format as Practical-1, Practical-2, and Practical-3: left-aligned roll number with KLH logo at top right, title and italic subtitle, Times New Roman body, Consolas code/output, Q1-Q5 answers, Program Output, VS Code Execution, and two real VS Code figures.
- No project/application screenshots are included; this submission is only for the practical case studies.
