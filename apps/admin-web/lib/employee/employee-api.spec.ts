import { buildEmployeeQuery } from './employee-api';

describe('buildEmployeeQuery', () => {
  it('should return empty string when no params are provided', () => {
    expect(buildEmployeeQuery({})).toBe('');
  });

  it('should build correct query string with pagination and search', () => {
    const query = buildEmployeeQuery({
      page: 2,
      limit: 50,
      search: 'Ravi',
    });
    expect(query).toContain('page=2');
    expect(query).toContain('limit=50');
    expect(query).toContain('search=Ravi');
  });

  it('should include filters for employmentStatus and department', () => {
    const query = buildEmployeeQuery({
      employmentStatus: 'ACTIVE',
      department: 'OPERATIONS',
      sortBy: 'joiningDate',
      sortOrder: 'asc',
    });
    expect(query).toContain('employmentStatus=ACTIVE');
    expect(query).toContain('department=OPERATIONS');
    expect(query).toContain('sortBy=joiningDate');
    expect(query).toContain('sortOrder=asc');
  });
});
