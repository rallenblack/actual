import React, { useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgAdd,
  SvgArrowDown,
  SvgArrowUp,
  SvgDotsHorizontalTriple,
} from '@actual-app/components/icons/v1';
import { Input } from '@actual-app/components/input';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';

import {
  useCreateCategoryGroupMutation,
  useCreateCategoryMutation,
  useDeleteCategoryGroupMutation,
  useDeleteCategoryMutation,
  useMoveCategoryGroupMutation,
  useMoveCategoryMutation,
  useUpdateCategoryGroupMutation,
  useUpdateCategoryMutation,
} from '#budget';
import { useCategories } from '#hooks/useCategories';

function Badge({ text }: { text: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        color: theme.pageTextLight,
        backgroundColor: theme.tableBorder,
        borderRadius: 4,
        padding: '1px 6px',
      }}
    >
      {text}
    </Text>
  );
}

function MoveButtons({
  onUp,
  onDown,
  upDisabled,
  downDisabled,
}: {
  onUp: () => void;
  onDown: () => void;
  upDisabled: boolean;
  downDisabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row' }}>
      <Button
        variant="bare"
        isDisabled={upDisabled}
        aria-label={t('Move up')}
        onPress={onUp}
      >
        <SvgArrowUp
          width={11}
          height={11}
          style={{ color: theme.pageTextLight }}
        />
      </Button>
      <Button
        variant="bare"
        isDisabled={downDisabled}
        aria-label={t('Move down')}
        onPress={onDown}
      >
        <SvgArrowDown
          width={11}
          height={11}
          style={{ color: theme.pageTextLight }}
        />
      </Button>
    </View>
  );
}

function RowMenu({
  items,
  onSelect,
}: {
  items: Array<{ name: string; text: string } | typeof Menu.line>;
  onSelect: (name: string) => void;
}) {
  const { t } = useTranslation();
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Button
        ref={triggerRef}
        variant="bare"
        aria-label={t('Menu')}
        onPress={() => setOpen(true)}
      >
        <SvgDotsHorizontalTriple
          width={15}
          height={15}
          style={{ color: theme.pageTextLight }}
        />
      </Button>
      <Popover
        triggerRef={triggerRef}
        isOpen={open}
        onOpenChange={() => setOpen(false)}
      >
        <Menu
          items={items}
          onMenuSelect={name => {
            setOpen(false);
            onSelect(name);
          }}
        />
      </Popover>
    </View>
  );
}

function EditableName({
  value,
  weight,
  dim,
  onSave,
}: {
  value: string;
  weight?: number;
  dim?: boolean;
  onSave: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  function commit(next: string) {
    setEditing(false);
    const name = next.trim();
    if (name && name !== value) onSave(name);
  }

  if (editing) {
    return (
      <Input
        defaultValue={value}
        autoFocus
        onEnter={next => commit(next)}
        onUpdate={next => commit(next)}
        onEscape={() => setEditing(false)}
        style={{ flex: 1, minWidth: 0 }}
      />
    );
  }

  return (
    <Text
      style={{
        flex: 1,
        minWidth: 0,
        cursor: 'pointer',
        fontWeight: weight,
        color: dim ? theme.pageTextSubdued : theme.pageText,
      }}
      onClick={() => setEditing(true)}
    >
      {value}
    </Text>
  );
}

function NewNameInput({
  placeholder,
  onSave,
  onCancel,
}: {
  placeholder: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  return (
    <View style={{ padding: 8 }}>
      <Input
        autoFocus
        placeholder={placeholder}
        onEnter={next => {
          const name = next.trim();
          if (name) onSave(name);
          else onCancel();
        }}
        onEscape={onCancel}
        onUpdate={next => {
          if (!next.trim()) onCancel();
        }}
      />
    </View>
  );
}

export function ManageCategories() {
  const { t } = useTranslation();
  const { data: { grouped: groups = [] } = { grouped: [] } } = useCategories();

  const createGroup = useCreateCategoryGroupMutation();
  const updateGroup = useUpdateCategoryGroupMutation();
  const deleteGroup = useDeleteCategoryGroupMutation();
  const moveGroup = useMoveCategoryGroupMutation();
  const createCategory = useCreateCategoryMutation();
  const updateCategory = useUpdateCategoryMutation();
  const deleteCategory = useDeleteCategoryMutation();
  const moveCategory = useMoveCategoryMutation();

  const [addingGroup, setAddingGroup] = useState(false);
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);

  // moveCategoryGroup/category inserts `id` BEFORE `targetId` (null = end).
  function moveGroupBy(index: number, dir: 'up' | 'down') {
    const targetId =
      dir === 'up' ? groups[index - 1]?.id : (groups[index + 2]?.id ?? null);
    moveGroup.mutate({ id: groups[index].id, targetId: targetId ?? null });
  }

  function moveCatBy(
    group: CategoryGroupEntity,
    index: number,
    dir: 'up' | 'down',
  ) {
    const cats = group.categories ?? [];
    const targetId =
      dir === 'up' ? cats[index - 1]?.id : (cats[index + 2]?.id ?? null);
    moveCategory.mutate({
      id: cats[index].id,
      groupId: group.id,
      targetId: targetId ?? null,
    });
  }

  return (
    <View style={{ flex: 1, overflowY: 'auto' }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Text style={{ color: theme.pageTextLight }}>
          {t(
            'Add, rename, hide, reorder, and delete your category groups and categories.',
          )}
        </Text>
        <Button variant="primary" onPress={() => setAddingGroup(true)}>
          <SvgAdd width={10} height={10} style={{ marginRight: 5 }} />
          <Trans>Add group</Trans>
        </Button>
      </View>

      {addingGroup && (
        <View
          style={{
            border: '1px solid ' + theme.tableBorder,
            borderRadius: 6,
            marginBottom: 8,
          }}
        >
          <NewNameInput
            placeholder={t('New group name')}
            onSave={name => {
              createGroup.mutate({ name });
              setAddingGroup(false);
            }}
            onCancel={() => setAddingGroup(false)}
          />
        </View>
      )}

      {groups.map((group, gi) => {
        const categories = group.categories ?? [];
        return (
          <View
            key={group.id}
            style={{
              flexShrink: 0,
              border: '1px solid ' + theme.tableBorder,
              borderRadius: 6,
              marginBottom: 8,
            }}
          >
            <View
              style={{
                flexShrink: 0,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                minHeight: 40,
                padding: '10px 8px',
                backgroundColor: theme.tableRowHeaderBackground,
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
              }}
            >
              <MoveButtons
                onUp={() => moveGroupBy(gi, 'up')}
                onDown={() => moveGroupBy(gi, 'down')}
                upDisabled={gi === 0}
                downDisabled={gi === groups.length - 1}
              />
              <EditableName
                value={group.name}
                weight={600}
                dim={group.hidden}
                onSave={name =>
                  updateGroup.mutate({ group: { ...group, name } })
                }
              />
              {group.is_income && <Badge text={t('Income')} />}
              {group.hidden && <Badge text={t('Hidden')} />}
              <Button variant="bare" onPress={() => setAddingToGroup(group.id)}>
                <SvgAdd width={9} height={9} style={{ marginRight: 4 }} />
                <Trans>Category</Trans>
              </Button>
              <RowMenu
                items={[
                  { name: 'hide', text: group.hidden ? t('Show') : t('Hide') },
                  Menu.line,
                  { name: 'delete', text: t('Delete') },
                ]}
                onSelect={name => {
                  if (name === 'hide') {
                    updateGroup.mutate({
                      group: { ...group, hidden: !group.hidden },
                    });
                  } else if (name === 'delete') {
                    deleteGroup.mutate({ id: group.id });
                  }
                }}
              />
            </View>

            {categories.map((cat: CategoryEntity, ci: number) => (
              <View
                key={cat.id}
                style={{
                  flexShrink: 0,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: 36,
                  padding: '10px 8px 10px 28px',
                  borderTop: '1px solid ' + theme.tableBorder,
                }}
              >
                <MoveButtons
                  onUp={() => moveCatBy(group, ci, 'up')}
                  onDown={() => moveCatBy(group, ci, 'down')}
                  upDisabled={ci === 0}
                  downDisabled={ci === categories.length - 1}
                />
                <EditableName
                  value={cat.name}
                  dim={cat.hidden}
                  onSave={name =>
                    updateCategory.mutate({ category: { ...cat, name } })
                  }
                />
                {cat.hidden && <Badge text={t('Hidden')} />}
                <RowMenu
                  items={[
                    { name: 'hide', text: cat.hidden ? t('Show') : t('Hide') },
                    Menu.line,
                    { name: 'delete', text: t('Delete') },
                  ]}
                  onSelect={name => {
                    if (name === 'hide') {
                      updateCategory.mutate({
                        category: { ...cat, hidden: !cat.hidden },
                      });
                    } else if (name === 'delete') {
                      deleteCategory.mutate({ id: cat.id });
                    }
                  }}
                />
              </View>
            ))}

            {addingToGroup === group.id && (
              <View style={{ borderTop: '1px solid ' + theme.tableBorder }}>
                <NewNameInput
                  placeholder={t('New category name')}
                  onSave={name => {
                    createCategory.mutate({
                      name,
                      groupId: group.id,
                      isIncome: !!group.is_income,
                      isHidden: false,
                    });
                    setAddingToGroup(null);
                  }}
                  onCancel={() => setAddingToGroup(null)}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
