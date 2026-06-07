import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';

import { FeatureErrorFallback } from '#components/FeatureErrorFallback';

import { ManageCategories } from './ManageCategories';
import { Page } from './Page';

export function ManageCategoriesPage() {
  const { t } = useTranslation();
  return (
    <ErrorBoundary FallbackComponent={FeatureErrorFallback}>
      <Page header={t('Categories')}>
        <ManageCategories />
      </Page>
    </ErrorBoundary>
  );
}
